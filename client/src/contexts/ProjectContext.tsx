import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface Project {
  id: number;
  code: string;
  name: string;
  description: string | null;
  active: number;
}

interface ProjectContextType {
  projects: Project[];
  canSeeAllProjects: boolean;
  activeProject: Project | null;
  setActiveProjectId: (id: number | null) => void;
  isAllProjects: boolean;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  canSeeAllProjects: false,
  activeProject: null,
  setActiveProjectId: () => {},
  isAllProjects: false,
  loading: true,
});

const PROJECT_STORAGE_KEY = "active-project-id";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const canSeeAllProjects = user?.role === "admin" || user?.role === "dono_obra";

  const { data: projects = [], isLoading } = trpc.projects.list.useQuery(undefined, {
    enabled: !!user,
  });

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

  useEffect(() => {
    if (!isLoading && projects.length > 0 && !canSeeAllProjects && activeProjectId === null) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, isLoading, canSeeAllProjects, activeProjectId]);

  useEffect(() => {
    if (!isLoading && projects.length > 0 && activeProjectId !== null) {
      const exists = projects.some(p => p.id === activeProjectId);
      if (!exists) setActiveProjectId(canSeeAllProjects ? null : projects[0]?.id ?? null);
    }
  }, [projects, isLoading, activeProjectId, canSeeAllProjects]);

  const activeProject = activeProjectId !== null
    ? projects.find(p => p.id === activeProjectId) || null
    : null;

  const isAllProjects = activeProjectId === null && canSeeAllProjects;

  return (
    <ProjectContext.Provider value={{
      projects,
      activeProject,
      canSeeAllProjects,
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
