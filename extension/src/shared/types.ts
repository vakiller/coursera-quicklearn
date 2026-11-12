export type ItemType = 'video' | 'reading' | 'quiz' | 'other';
export type ItemStatus = 'ok' | 'locked' | 'unavailable' | 'error' | 'removed' | 'not_fetched';

export interface OutlineItem {
  id: string;
  slug: string;
  name: string;
  type: ItemType;
  graded: boolean;
  locked: boolean;
  lessonName: string;
  durationMin?: number;
}

export interface OutlineModule {
  id: string;
  slug: string;
  name: string;
  description: string;
  learningObjectives: string[];
  items: OutlineItem[];
}

export interface CourseOutline {
  id: string;
  slug: string;
  name: string;
  modules: OutlineModule[];
}

export interface ManifestItem {
  index: number;
  id: string;
  type: ItemType;
  title: string;
  graded?: boolean;
  file: string | null;
  content_hash: string | null;
  status: ItemStatus;
}

export interface ManifestModule {
  index: number;
  id: string;
  title: string;
  folder: string;
  items: ManifestItem[];
}

export interface Manifest {
  schema: 'coursera-vault/1';
  course: { id: string; slug: string; title: string; fetched_at: string };
  modules: ManifestModule[];
}
