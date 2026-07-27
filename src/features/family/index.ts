export interface FamilyMember {
  id: string;
  name: string;
  phone: string;
  role: 'viewer' | 'editor' | 'owner';
}

export const inviteFamilyMember = async (phone: string) => {
  // TODO: wire into backend or local mock flow
  return { success: true };
};
