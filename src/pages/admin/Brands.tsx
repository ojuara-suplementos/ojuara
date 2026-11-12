import { TaxonomyManager } from "@/components/admin/TaxonomyManager";

export default function AdminBrands() {
  return (
    <TaxonomyManager
      table="brands"
      title="Marcas"
      description="Cadastre as marcas que fazem parte do arsenal Ojuara."
    />
  );
}
