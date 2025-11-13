import React, { useState, useEffect } from 'react';
import { Project } from '../types/types';
import { BriefcaseIcon, ChevronRightIcon, PlusCircleIcon, PencilIcon, TrashIcon } from './icons';

interface ProjectSelectorProps {
    projects: Project[];
    activeProjectId: string | null;
    onCreateProject: (name: string) => void;
    onSwitchProject: (id: string) => void;
    onRenameProject: (id: string, newName: string) => void;
    onDeleteProject: (id: string) => void;
}

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string) => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [name, setName] = useState('');
    if (!isOpen) return null;

    const handleCreate = () => {
        if (name.trim()) {
            onCreate(name.trim());
            setName('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-db-dark-2 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-200 dark:border-db-dark-3" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Project</h2>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-db-dark border border-gray-300 dark:border-db-dark-3 rounded px-3 py-2 text-gray-900 dark:text-db-light focus:outline-none focus:ring-1 focus:ring-db-accent"
                    placeholder="Project Name"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-db-dark-3 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-opacity-80 transition-colors">Cancel</button>
                    <button onClick={handleCreate} disabled={!name.trim()} className="px-4 py-2 rounded bg-db-accent hover:bg-db-accent-hover text-white disabled:bg-gray-400 dark:disabled:bg-gray-500 transition-colors">Create</button>
                </div>
            </div>
        </div>
    );
};

const RenameProjectModal: React.FC<{ project: Project | null, isOpen: boolean, onClose: () => void, onRename: (id: string, newName: string) => void }> = ({ project, isOpen, onClose, onRename }) => {
    const [name, setName] = useState('');
    
    useEffect(() => {
        if (project) setName(project.name);
    }, [project]);

    if (!isOpen || !project) return null;

    const handleRename = () => {
        if (name.trim() && name.trim() !== project.name) {
            onRename(project.id, name.trim());
        }
        onClose();
    };

    return (
         <div className="fixed inset-0 bg-gray-900/60 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-db-dark-2 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-200 dark:border-db-dark-3" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rename Project</h2>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-db-dark border border-gray-300 dark:border-db-dark-3 rounded px-3 py-2 text-gray-900 dark:text-db-light focus:outline-none focus:ring-1 focus:ring-db-accent"
                    placeholder="Project Name"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                />
                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-db-dark-3 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-opacity-80 transition-colors">Cancel</button>
                    <button onClick={handleRename} disabled={!name.trim()} className="px-4 py-2 rounded bg-db-accent hover:bg-db-accent-hover text-white disabled:bg-gray-400 dark:disabled:bg-gray-500 transition-colors">Save</button>
                </div>
            </div>
        </div>
    );
};

const ConfirmDeleteModal: React.FC<{ project: Project | null, isOpen: boolean, onClose: () => void, onDelete: (id: string) => void }> = ({ project, isOpen, onClose, onDelete }) => {
    if (!isOpen || !project) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/60 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-db-dark-2 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-200 dark:border-db-dark-3" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Project</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Are you sure you want to delete the project "<span className="font-bold">{project.name}</span>"?
                    This action is irreversible and will delete all associated data.
                </p>
                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-db-dark-3 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-opacity-80 transition-colors">Cancel</button>
                    <button onClick={() => onDelete(project.id)} className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white transition-colors">Delete</button>
                </div>
            </div>
        </div>
    );
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects, activeProjectId, onCreateProject, onSwitchProject, onRenameProject, onDeleteProject }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [projectToRename, setProjectToRename] = useState<Project | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

    const activeProject = projects.find(p => p.id === activeProjectId);

    useEffect(() => {
        const close = () => setIsOpen(false);
        if (isOpen) {
            window.addEventListener('click', close);
        }
        return () => window.removeEventListener('click', close);
    }, [isOpen]);

    return (
        <div className="relative" onClick={e => e.stopPropagation()}>
            <CreateProjectModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreate={onCreateProject} />
            <RenameProjectModal isOpen={!!projectToRename} project={projectToRename} onClose={() => setProjectToRename(null)} onRename={onRenameProject} />
            <ConfirmDeleteModal isOpen={!!projectToDelete} project={projectToDelete} onClose={() => setProjectToDelete(null)} onDelete={onDeleteProject} />

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-db-dark-3 rounded hover:bg-gray-200 dark:hover:bg-db-dark-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
            >
                <div className="flex items-center truncate">
                    <BriefcaseIcon className="mr-2 text-gray-500 dark:text-gray-400" />
                    <span className="font-semibold text-sm truncate">{activeProject?.name || 'No Project Selected'}</span>
                </div>
                <ChevronRightIcon className={`transform transition-transform text-gray-500 ${isOpen ? 'rotate-90' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-db-dark-2 border border-gray-200 dark:border-db-dark-3 rounded-md shadow-lg z-20 py-1">
                    {projects.map(project => (
                        <div key={project.id} className="group flex items-center justify-between px-4 py-2 hover:bg-gray-100 dark:hover:bg-db-dark-3 cursor-pointer">
                            <button
                                onClick={() => onSwitchProject(project.id)}
                                disabled={project.id === activeProjectId}
                                className="w-full text-left text-sm text-gray-800 dark:text-db-light disabled:opacity-50 disabled:cursor-default truncate"
                            >
                                {project.name}
                            </button>
                            <div className="flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => setProjectToRename(project)}
                                    className="p-1 rounded-full hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
                                    title="Rename project"
                                >
                                    <PencilIcon />
                                </button>
                                <button
                                    onClick={() => setProjectToDelete(project)}
                                    className="p-1 rounded-full hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
                                    title="Delete project"
                                >
                                    <TrashIcon />
                                </button>
                            </div>
                        </div>
                    ))}
                    <div className="border-t border-gray-200 dark:border-db-dark-3 my-1"></div>
                    <button
                        onClick={() => { setIsCreateModalOpen(true); setIsOpen(false); }}
                        className="w-full flex items-center px-4 py-2 text-sm text-gray-800 dark:text-db-light hover:bg-db-accent hover:text-white rounded-md"
                    >
                        <PlusCircleIcon className="mr-2" />
                        Create New Project
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProjectSelector;

