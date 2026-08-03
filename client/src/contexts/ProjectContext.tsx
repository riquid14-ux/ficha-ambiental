import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

interface Project {
  id: number;
  code: string;
  name: string;
  description: string | null;
  active: number;
}

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  setActiveProjectId: (id: number | null) => void;
  isAllProjects: boolean;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  activeProject: null,
  setActiveProjectId: () => {},
  isAllProjects: false,
  loading: true,
});

const PROJECT_STORAGE_KEY = "active-project-id";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { data: projects = [], isLoading } = trpc.projects.list.useQuery();
  const [activeProjectId, setActiveProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem(PROJECT_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : null;
  });

  useEffect(() => {
    if (activeProjectId !== null) {
      localStorage.setItem(PROJECT_STORAGE_KEY, activeProjectId.toString());
    } else {
      localStorage.removeItem(PROJECT_STORAGE_KEY);
    }
  }, [activeProjectId]);

  // If saved project is not in list, reset to null (all projects)
  useEffect(() => {
    if (!isLoading && projects.length > 0 && activeProjectId !== null) {
      const exists = projects.some(p => p.id === activeProjectId);
      if (!exists) setActiveProjectId(null);
    }
  }, [projects, isLoading, activeProjectId]);

  const activeProject = activeProjectId !== null
    ? projects.find(p => p.id === activeProjectId) || null
    : null;

  const isAllProjects = activeProjectId === null;

  return (
    <ProjectContext.Provider value={{
      projects,
      activeProject,
      setActiveProjectId,
      isAllProjects,
      loading: isLoading,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
