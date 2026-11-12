-- Données de démonstration : toute l'équipe part des mêmes lignes.
-- Le catalogue est SYNTHÉTIQUE (codes SYN-…) : aucune référence réelle de Givaudan.
-- Pas de prix ni de délais : ils sont toujours confirmés par Givaudan.

INSERT INTO questions (question, answer)
SELECT q, a FROM (VALUES
  ('Quelle est la capitale de la France ?', 'Paris.'),
  ('Combien de temps dure le hackathon ?', 'Deux semaines.')
) AS v (q, a)
WHERE NOT EXISTS (SELECT 1 FROM questions);

INSERT INTO clients (name, company, email, address)
SELECT 'Julien', 'PME Boissons', 'julien@pme-boissons.example', '12 rue des Vergers, 69000 Lyon'
WHERE NOT EXISTS (SELECT 1 FROM clients);

INSERT INTO flavors (code, name, family, notes, is_natural, formats, applications, strengths, packagings, description) VALUES
  ('SYN-FR-101', 'Fruits rouges gourmand', 'fruits rouges', '{fraise,framboise,cassis,sucré}', true, '{poudre}', '{boisson protéinée,produit laitier}', '{Couvre la note des protéines,Bonne tenue en poudre}', '{1 kg,5 kg,25 kg}', 'Arôme naturel fruits rouges rond et gourmand, formulé pour les poudres à reconstituer.'),
  ('SYN-FR-102', 'Fruits rouges acidulé', 'fruits rouges', '{framboise,groseille,acidulé,frais}', true, '{poudre,liquide}', '{boisson protéinée,eau aromatisée,boisson énergisante}', '{Profil frais et acidulé}', '{1 kg,5 kg}', 'Arôme naturel fruits rouges vif, à dominante framboise et groseille.'),
  ('SYN-FR-103', 'Fraise des bois', 'fruits rouges', '{fraise,floral,sucré}', true, '{liquide}', '{produit laitier,soda,confiserie}', '{Note fraise authentique}', '{1 kg,5 kg,25 kg}', 'Arôme naturel fraise des bois, note fruitée et légèrement florale.'),
  ('SYN-FR-104', 'Cerise noire', 'fruits rouges', '{cerise,amande,intense}', false, '{poudre,liquide}', '{boisson énergisante,soda,confiserie}', '{Intensité élevée à faible dosage}', '{5 kg,25 kg}', 'Arôme cerise noire intense, avec une touche d''amande.'),
  ('SYN-FR-105', 'Cassis intense', 'fruits rouges', '{cassis,boisé,acidulé}', true, '{liquide}', '{soda,eau aromatisée}', '{Couleur aromatique marquée}', '{1 kg,5 kg}', 'Arôme naturel de cassis, profil intense et légèrement boisé.'),
  ('SYN-AG-201', 'Citron zesté', 'agrumes', '{citron,zeste,frais}', true, '{liquide}', '{eau aromatisée,soda}', '{Fraîcheur durable}', '{1 kg,5 kg,25 kg}', 'Arôme naturel de citron, note zestée et pétillante.'),
  ('SYN-AG-202', 'Orange douce', 'agrumes', '{orange,sucré,pulpe}', true, '{poudre,liquide}', '{boisson protéinée,soda,produit laitier}', '{Profil jus pressé}', '{1 kg,5 kg,25 kg}', 'Arôme naturel d''orange douce, rond et pulpeux.'),
  ('SYN-AG-203', 'Yuzu', 'agrumes', '{yuzu,pamplemousse,floral}', true, '{liquide}', '{eau aromatisée,boisson énergisante}', '{Signature originale}', '{1 kg,5 kg}', 'Arôme naturel de yuzu, agrume floral et légèrement amer.'),
  ('SYN-AG-204', 'Pamplemousse rose', 'agrumes', '{pamplemousse,amer,frais}', false, '{poudre,liquide}', '{boisson énergisante,eau aromatisée}', '{Amertume maîtrisée}', '{5 kg,25 kg}', 'Arôme pamplemousse rose, frais avec une amertume légère.'),
  ('SYN-VA-301', 'Vanille bourbon', 'vanille', '{vanille,crémeux,boisé}', true, '{poudre,liquide}', '{boisson protéinée,produit laitier,boulangerie}', '{Arrondit les notes de protéines,Bonne tenue en poudre}', '{1 kg,5 kg,25 kg}', 'Arôme naturel de vanille bourbon, crémeux et légèrement boisé.'),
  ('SYN-VA-302', 'Vanille crème', 'vanille', '{vanille,lacté,sucré}', false, '{poudre}', '{boisson protéinée,confiserie}', '{Effet lacté}', '{5 kg,25 kg}', 'Arôme vanille crème au profil lacté et sucré.'),
  ('SYN-CH-401', 'Cacao intense', 'chocolat', '{cacao,torréfié,amer}', true, '{poudre}', '{boisson protéinée,barre,boulangerie}', '{Couvre la note des protéines}', '{1 kg,5 kg,25 kg}', 'Arôme naturel de cacao torréfié, profil intense.'),
  ('SYN-CH-402', 'Chocolat au lait', 'chocolat', '{chocolat,lacté,caramel}', false, '{poudre,liquide}', '{produit laitier,barre,confiserie}', '{Profil gourmand}', '{5 kg,25 kg}', 'Arôme chocolat au lait doux, avec une touche caramel.'),
  ('SYN-CA-501', 'Café espresso', 'café', '{café,torréfié,intense}', true, '{poudre,liquide}', '{boisson protéinée,boisson énergisante,produit laitier}', '{Note torréfiée marquée}', '{1 kg,5 kg}', 'Arôme naturel de café espresso, intense et torréfié.'),
  ('SYN-TR-601', 'Mangue passion', 'fruits tropicaux', '{mangue,passion,exotique}', true, '{poudre,liquide}', '{boisson protéinée,eau aromatisée,soda}', '{Profil exotique solaire}', '{1 kg,5 kg,25 kg}', 'Arôme naturel mangue et fruit de la passion.'),
  ('SYN-TR-602', 'Ananas coco', 'fruits tropicaux', '{ananas,coco,sucré}', false, '{liquide}', '{soda,produit laitier}', '{Note cocktail}', '{5 kg,25 kg}', 'Arôme ananas et noix de coco, esprit cocktail.'),
  ('SYN-NO-701', 'Pêche blanche', 'fruits à noyau', '{pêche,juteux,floral}', true, '{liquide}', '{eau aromatisée,soda}', '{Note juteuse}', '{1 kg,5 kg}', 'Arôme naturel de pêche blanche, juteux et floral.'),
  ('SYN-NO-702', 'Abricot rôti', 'fruits à noyau', '{abricot,caramélisé}', false, '{poudre}', '{barre,boulangerie}', '{Stable à la cuisson}', '{5 kg,25 kg}', 'Arôme abricot rôti aux notes caramélisées.'),
  ('SYN-ME-801', 'Menthe fraîche', 'menthe', '{menthe,frais,végétal}', true, '{liquide}', '{eau aromatisée,soda,confiserie}', '{Fraîcheur immédiate}', '{1 kg,5 kg}', 'Arôme naturel de menthe verte, frais et végétal.'),
  ('SYN-CR-901', 'Caramel beurre salé', 'caramel', '{caramel,beurre,salé}', false, '{poudre,liquide}', '{boisson protéinée,produit laitier,barre}', '{Profil gourmand}', '{5 kg,25 kg}', 'Arôme caramel au beurre salé, rond et gourmand.'),
  ('SYN-PO-951', 'Pomme verte', 'pomme', '{pomme,acidulé,frais}', true, '{liquide}', '{eau aromatisée,soda}', '{Profil croquant}', '{1 kg,5 kg}', 'Arôme naturel de pomme verte, acidulé et croquant.'),
  ('SYN-HE-961', 'Basilic citronné', 'herbes', '{basilic,citron,végétal}', true, '{liquide}', '{eau aromatisée,soda}', '{Note botanique}', '{1 kg}', 'Arôme naturel de basilic à touche citronnée.')
ON CONFLICT (code) DO NOTHING;
