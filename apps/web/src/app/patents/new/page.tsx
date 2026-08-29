import { redirect } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { NewPatentForm } from '@/components/new-patent-form';
import { createClient } from '@/lib/supabase/server';

export default async function NewPatentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [categories, purposes, chemicals, commercialProducts, roles] = await Promise.all([
    supabase.from('application_categories').select('id,name').order('name'),
    supabase.from('technical_purposes').select('id,name').order('name'),
    supabase.from('chemicals').select('id,canonical_name,abbreviation,cas_number,chemical_class').order('canonical_name'),
    supabase.from('commercial_products').select('id,trade_name,manufacturer,product_type').order('trade_name'),
    supabase.from('chemical_roles').select('id,name').order('name'),
  ]);

  return (
    <AppShell email={user.email ?? 'Kullanıcı'}>
      <NewPatentForm
        categories={categories.data ?? []}
        chemicals={chemicals.data ?? []}
        commercialProducts={commercialProducts.data ?? []}
        purposes={purposes.data ?? []}
        roles={roles.data ?? []}
        userId={user.id}
      />
    </AppShell>
  );
}
