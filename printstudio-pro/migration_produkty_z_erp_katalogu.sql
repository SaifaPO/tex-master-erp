-- Produkty (Blanks) v PrintStudio <-> Katalog produktov v ERP: zakladna cena sa moze preberat priamo z vyrobnej ceny
-- produktu v ERP katalogu (products.production_cost = material + sitie + potlac + rezia...), takze cena sa upravuje len na jednom mieste.
-- Vsetky konfiguratory (Celenky, Buffky, Dizajner, Dres 3D...) cítaju produkty.zakladna_cena, preto sa hodnota synchronizuje do nej
-- automaticky: pri prepojeni a potom pri kazdej zmene vyrobnej ceny v ERP. Bezpecne spustit opakovane.

alter table produkty add column if not exists erp_produkt_id text references products(id) on delete set null;

-- 1) Pri ulozeni/prepojeni produktu sa cena hned prevezme z ERP katalogu
create or replace function produkty_prevzat_cenu_z_erp() returns trigger as $$
begin
  if new.erp_produkt_id is not null then
    new.zakladna_cena := coalesce((select production_cost from products where id = new.erp_produkt_id), new.zakladna_cena);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_produkty_prevzat_cenu_z_erp on produkty;
create trigger trg_produkty_prevzat_cenu_z_erp
  before insert or update of erp_produkt_id on produkty
  for each row execute function produkty_prevzat_cenu_z_erp();

-- 2) Zmena vyrobnej ceny v ERP katalogu sa prenesie do vsetkych prepojenych produktov
create or replace function erp_cena_do_produktov() returns trigger as $$
begin
  update produkty
     set zakladna_cena = coalesce(new.production_cost, 0), updated_at = now()
   where erp_produkt_id = new.id
     and zakladna_cena is distinct from coalesce(new.production_cost, 0);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_erp_cena_do_produktov on products;
create trigger trg_erp_cena_do_produktov
  after update of production_cost on products
  for each row execute function erp_cena_do_produktov();
