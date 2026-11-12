import { TaxonomyManager } from "@/components/admin/TaxonomyManager";

export default function AdminCategories() {
  return (
    <TaxonomyManager
      table="categories"
      title="Categorias"
      description="Organize o catálogo da Ojuara em grupos como Suplementos, Performance, Recuperação."
      withSlug
      withDescription

    />
  );
}
