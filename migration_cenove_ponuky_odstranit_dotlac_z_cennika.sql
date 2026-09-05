-- Cennik pre "Vyrobu" v Cenovych ponukach uz nema obsahovat kategorie Dotlac - Transfer/Sietotlac/
-- Vysivka - tie boli povodne pridane ako placeholder polozky, ale medzitym uz vznikla samostatna
-- strukturovana kalkulacka na potlac (tabulky quote_print_materials/quote_print_sizes, zalozka
-- "Kalkulačka tlače" + prepinac Vyroba/Potlac v tvorbe ponuky), takze su tieto riadky duplicitne.
-- POZOR: zmaze VSETKY polozky v cenniku s tymito kategoriami vratane prip. rucnych uprav, ktore
-- do nich Martin medzitym urobil - ak by chcel niektore zachovat, treba ich pred spustenim
-- prekategorizovat (zmenit kategoriu v zalozke Cenník) na Vlajky/Beachvlajky/Ostatne.
delete from quote_price_list where category in ('Dotlač - Transfer', 'Dotlač - Sieťotlač', 'Dotlač - Výšivka');
