export type KbRole = 'owner' | 'editor' | 'reader';

export type PublicKb = {
  id: string;
  name: string;
  description: string | null;
  visibility: 'private';
  role: KbRole;
  createdAt: string;
  updatedAt: string;
};
