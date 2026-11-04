import type { ArticleStatus, ArticleType } from "@prisma/client";
import type { MediaDto } from "@/app/Admin/_actions/media";
import type { WorkflowAction } from "@/lib/workflow/machine";

export interface EditorArticle {
  id: number;
  type: ArticleType;
  status: ArticleStatus;
  version: number;
  title: string;
  sapo: string;
  contentHtml: string;
  primaryCatId: number;
  categoryIds: number[];
  sourceId: number;
  authorName: string;
  cover: MediaDto | null;
  tags: string[];
  topicIds: number[];
  slug: string;
  seoTitle: string;
  seoDescription: string;
  isUrgent: boolean;
  externalUrl: string;
  photos: { media: MediaDto; caption: string; takenAt: string | null }[];
  isPinned: boolean;
  scheduledAt: string | null;
  correctionNote: string | null;
}

export interface ActionButton {
  action: WorkflowAction;
  label: string;
  tone: "primary" | "default" | "danger";
  requiresReason: boolean;
}

export interface Option {
  id: number;
  name: string;
  group?: string;
}
