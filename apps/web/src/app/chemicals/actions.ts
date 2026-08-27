'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export async function createChemical(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: chemical, error } = await supabase.from('chemicals').insert({
    owner_user_id: user.id,
    canonical_name: value(form, 'canonical_name'),
    abbreviation: value(form, 'abbreviation') || null,
    cas_number: value(form, 'cas_number') || null,
    molecular_formula: value(form, 'molecular_formula') || null,
    chemical_class: value(form, 'chemical_class') || null,
    notes: value(form, 'notes') || null,
  }).select('id').single();
  if (error) redirect(`/chemicals?error=${encodeURIComponent(error.message)}`);

  const synonyms = value(form, 'synonyms').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 30);
  if (synonyms.length) {
    const { error: synonymError } = await supabase.from('chemical_synonyms').insert(synonyms.map((synonym) => ({ chemical_id: chemical.id, synonym })));
    if (synonymError) redirect(`/chemicals?error=${encodeURIComponent(synonymError.message)}`);
  }
  revalidatePath('/chemicals');
  redirect('/chemicals?message=Kimyasal kaydedildi.');
}

export async function createCommercialProduct(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: product, error } = await supabase.from('commercial_products').insert({
    owner_user_id: user.id,
    trade_name: value(form, 'trade_name'),
    manufacturer: value(form, 'manufacturer') || null,
    product_type: value(form, 'product_type') || null,
    description: value(form, 'description') || null,
    notes: value(form, 'notes') || null,
  }).select('id').single();
  if (error) redirect(`/chemicals?error=${encodeURIComponent(error.message)}`);

  const chemicalIds = form.getAll('chemical_ids').map(String);
  if (chemicalIds.length) {
    const { error: mappingError } = await supabase.from('commercial_product_chemicals').insert(chemicalIds.map((chemical_id) => ({ commercial_product_id: product.id, chemical_id })));
    if (mappingError) redirect(`/chemicals?error=${encodeURIComponent(mappingError.message)}`);
  }
  revalidatePath('/chemicals');
  redirect('/chemicals?message=Ticari ürün kaydedildi.');
}
