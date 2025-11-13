import { useState, useEffect, useCallback } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { TableInfo, QueryResult, ColumnInfo, PersistedFile } from '../types/types';

interface FileGroup {
    type: 'folder' | 'file';
    name: string;
    files: (File | PersistedFile)[];
}

export const useDuckDB = () => {
    const [db, setDb] = useState<duckdb.AsyncDuckDB | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initDB = async () => {
            try {
                const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
                    mvp: {
                        mainModule: duckdb_wasm,
                        mainWorker: mvp_worker,
                    },
                    eh: {
                        mainModule: duckdb_wasm_eh,
                        mainWorker: eh_worker,
                    },
                };
                const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
                const worker = new Worker(bundle.mainWorker!);
                const logger = new duckdb.ConsoleLogger();
                const newDb = new duckdb.AsyncDuckDB(logger, worker);

                await newDb.instantiate(bundle.mainModule, bundle.pthreadWorker);
                
                await newDb.open({
                    path: ':memory:',
                    query: {
                        castBigIntToDouble: true,
                    },
                });
                
                setDb(newDb);
            } catch (e: any) {
                const msg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
                console.error('Error initializing DuckDB:', e);
                setError(msg);
            } finally {
                setIsLoading(false);
            }
        };

        initDB();

        return () => {
            db?.terminate();
        };
    }, []);

    const ensureExtension = useCallback(async (connection: duckdb.AsyncDuckDBConnection, name: string) => {
        try {
            await connection.query(`INSTALL ${name}; LOAD ${name};`);
        } catch (e) {
        }
    }, []);

    const loadFiles = useCallback(async (files: (File | PersistedFile)[], opts?: {
        onBegin?: (info: { totalGroups: number; totalFiles: number }) => void;
        onProgress?: (info: { groupIndex: number; groupName: string; totalGroups: number; processedFiles: number; totalFiles: number }) => void;
        isAborted?: () => boolean;
    }): Promise<TableInfo[]> => {
        if (!db) throw new Error('Database not initialized');
        const newTables: TableInfo[] = [];

        const fileGroups: FileGroup[] = [];
        const folders = new Map<string, (File | PersistedFile)[]>();

        for (const file of files) {
            const relativePath = file instanceof File && file.webkitRelativePath ? file.webkitRelativePath : ('webkitRelativePath' in file ? file.webkitRelativePath : undefined);
            if (relativePath) {
                const dirName = relativePath.split('/')[0];
                if (!folders.has(dirName)) {
                    folders.set(dirName, []);
                }
                folders.get(dirName)!.push(file);
            } else {
                fileGroups.push({ type: 'file', name: file.name, files: [file] });
            }
        }

        folders.forEach((files, name) => {
            fileGroups.push({ type: 'folder', name, files });
        });
        
        const connection = await db.connect();
        try {
            const totalGroups = fileGroups.length;
            const totalFiles = fileGroups.reduce((acc, g) => acc + g.files.length, 0);
            let processedFiles = 0;
            opts?.onBegin?.({ totalGroups, totalFiles });
            for (let gi = 0; gi < fileGroups.length; gi++) {
                if (opts?.isAborted?.()) break;
                const group = fileGroups[gi];
                try {
                    for (const file of group.files) {
                        if (opts?.isAborted?.()) break;
                        const buffer = file instanceof File ? await file.arrayBuffer() : file.buffer;
                        const path = (file instanceof File ? file.webkitRelativePath : file.webkitRelativePath) || file.name;
                        await db.registerFileBuffer(path, new Uint8Array(buffer));
                        processedFiles += 1;
                        opts?.onProgress?.({ groupIndex: gi, groupName: group.name, totalGroups, processedFiles, totalFiles });
                    }
                    
                    const tableName = group.name.replace(/[^a-zA-Z0-9_]/g, '_');
                    let sourceFile = group.name;
                    let createdTable = false;

                    if (group.type === 'folder') {
                        const filePaths = group.files.map(f => (f instanceof File ? f.webkitRelativePath : f.webkitRelativePath) || f.name);
                        if (filePaths.some(path => path.includes('_delta_log'))) {
                            await ensureExtension(connection, 'delta');
                            await connection.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM '${group.name}';`);
                            createdTable = true;
                            sourceFile = `${group.name} (Delta)`;
                        }
                        else if (group.files.every(f => f.name.endsWith('.parquet'))) {
                            await connection.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM '${group.name}/*.parquet';`);
                            createdTable = true;
                            sourceFile = `${group.name} (Parquet Folder)`;
                        }
                    } else {
                        const file = group.files[0];
                        const fileName = file.name;
                        const filePath = ((file instanceof File ? file.webkitRelativePath : file.webkitRelativePath) || file.name);
                        const fileExtension = fileName.split('.').pop()?.toLowerCase();

                        switch (fileExtension) {
                            case 'xlsx':
                                await ensureExtension(connection, 'excel');
                                await connection.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_xlsx('${filePath}');`);
                                createdTable = true;
                                break;
                            case 'sqlite':
                            case 'db':
                                await ensureExtension(connection, 'sqlite');
                                await connection.query(`ATTACH '${filePath}' AS ${tableName} (TYPE SQLITE);`);
                                const tablesResult = await connection.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${tableName}';`);
                                const sqliteTables = tablesResult.toArray().map(row => (row.toJSON() as { table_name: string }).table_name);

                                for (const tbl of sqliteTables) {
                                    const viewName = `${tableName}_${tbl}`.replace(/[^a-zA-Z0-9_]/g, '_');
                                    await connection.query(`CREATE OR REPLACE VIEW ${viewName} AS SELECT * FROM ${tableName}."${tbl}";`);
                                    
                                    const result = await connection.query(`PRAGMA table_info('${viewName}');`);
                                    const columns = result.toArray().map(row => {
                                        const data = row.toJSON();
                                        return {
                                            column_name: data.name as string,
                                            column_type: data.type as string,
                                        };
                                    });
                                    newTables.push({ name: viewName, columns, sourceFile: `${fileName} (SQLite)`, isView: true });
                                }
                                break;
                            case 'csv':
                            case 'json':
                            case 'parquet':
                                await connection.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM '${filePath}';`);
                                createdTable = true;
                                break;
                            default:
                                console.warn(`Unsupported file type: ${fileName}`);
                                continue;
                        }
                    }

                    if (createdTable) {
                        const result = await connection.query(`PRAGMA table_info('${tableName}');`);
                        const columns = result.toArray().map(row => {
                            const data = row.toJSON();
                            return {
                                column_name: data.name as string,
                                column_type: data.type as string,
                            };
                        });
                        newTables.push({ name: tableName, columns, sourceFile });
                    }

                } catch (e: any) {
                    const groupName = group.name;
                    console.error(`Failed to load ${group.type} ${groupName}:`, e);
                    const m = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
                    throw new Error(`Error processing ${groupName}: ${m}`);
                }
            }
        } finally {
            if (connection) {
                await connection.close();
            }
        }
        return newTables;
    }, [db]);

    const runQuery = useCallback(async (sql: string): Promise<QueryResult> => {
        if (!db) throw new Error('Database not initialized');
        const startTime = performance.now();
        let connection: duckdb.AsyncDuckDBConnection | null = null;
        try {
            connection = await db.connect();
            const result = await connection.query(sql);
            const rows = result.toArray().map(row => Object.values(row.toJSON()));
            const columns = result.schema.fields.map(field => field.name);
            const endTime = performance.now();
            return {
                columns,
                rows,
                executionTime: endTime - startTime,
            };
        } catch (e: any) {
            console.error('Query error:', e);
            const endTime = performance.now();
            return {
                columns: [],
                rows: [],
                error: e?.message || (typeof e === 'string' ? e : JSON.stringify(e)),
                executionTime: endTime - startTime,
            };
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }, [db]);

    const getTablesInfo = useCallback(async (): Promise<TableInfo[]> => {
        if (!db) throw new Error('Database not initialized');
        let connection: duckdb.AsyncDuckDBConnection | null = null;
        try {
            connection = await db.connect();
            const tablesResult = await connection.query(`SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'main'`);
            const tablesArray = tablesResult.toArray().map(row => row.toJSON() as { table_name: string, table_type: string });

            const allTablesInfo: TableInfo[] = [];

            for (const table of tablesArray) {
                const tableName = table.table_name;
                const isView = table.table_type === 'VIEW';

                const result = await connection.query(`PRAGMA table_info('${tableName}');`);
                const columns = result.toArray().map(row => {
                    const data = row.toJSON();
                    return {
                        column_name: data.name as string,
                        column_type: data.type as string,
                    };
                });

                let dependencies: string[] | undefined = undefined;
                if (isView) {
                    try {
                        const viewDefResult = await connection.query(`SELECT view_definition FROM information_schema.views WHERE table_name = '${tableName}'`);
                        const viewDef = viewDefResult.toArray()[0]?.toJSON().view_definition as string;
                        if (viewDef) {
                            const tableNames = new Set<string>();
                            const regex = /(?:FROM|JOIN)\s+((?:"[^"]+")|(?:`[^`]+`)|[a-zA-Z0-9_]+)/gi;
                            let match;
                            while ((match = regex.exec(viewDef)) !== null) {
                                const tableNameWithQuotes = match[1];
                                const cleanTableName = tableNameWithQuotes.replace(/^[`"]|[`"]$/g, '');
                                tableNames.add(cleanTableName);
                            }
                            dependencies = Array.from(tableNames);
                        }
                    } catch (e) {
                        console.error(`Could not get view definition for ${tableName}:`, e);
                    }
                }

                allTablesInfo.push({ name: tableName, columns, isView, dependencies, sourceFile: '' });
            }
            return allTablesInfo;
        } catch (e: any) {
            console.error('Failed to get tables info:', e);
            throw new Error(`Error getting tables info: ${e.message}`);
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }, [db]);

    return { db, isLoading, error, loadFiles, runQuery, getTablesInfo };
};

