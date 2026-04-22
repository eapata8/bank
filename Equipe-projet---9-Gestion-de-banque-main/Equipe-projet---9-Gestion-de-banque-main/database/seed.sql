USE gestion_banque;

-- ============================================================
-- SEED — LEON BANK
-- Données de démonstration cohérentes et réalistes.
--
-- Principe de cohérence :
--   comptes.solde = Σ(transactions.montant WHERE compte_id = X AND statut = 'TERMINEE')
--   cartes_credit.solde_utilise = somme des achats non remboursés
--   Les dépôts/retraits EN_ATTENTE ou REJETE n'ont PAS de transaction miroir.
--   Les dépôts/retraits APPROUVE ont une transaction miroir équivalente.
--   Les factures PAYEE ont un PAIEMENT correspondant (même montant, même compte, même date).
--   Les virements ACCEPTE génèrent 2 transactions miroir (sortant/entrant) comme en prod.
--
-- Mot de passe demo : Demo123!   (hash bcrypt identique pour tout le monde)
-- ============================================================

-- ------------------------------------------------------------
-- Nettoyage
-- ------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE interac_beneficiaires;
TRUNCATE TABLE interac_transferts;
TRUNCATE TABLE interac_autodeposit;
TRUNCATE TABLE transactions_recurrentes;
TRUNCATE TABLE demandes_produits;
TRUNCATE TABLE retraits;
TRUNCATE TABLE depots_cheques;
TRUNCATE TABLE cartes_credit;
TRUNCATE TABLE virements;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE factures;
TRUNCATE TABLE transactions;
TRUNCATE TABLE comptes;
TRUNCATE TABLE utilisateurs_clients;
TRUNCATE TABLE clients;
TRUNCATE TABLE utilisateurs;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- UTILISATEURS (24 total : 5 demo nommés + 15 profils variés + 2 ex-non-liés + 2 modérateurs)
-- Hash bcrypt pour le mot de passe "Demo123!"
-- UTILISATEURS
-- ------------------------------------------------------------
INSERT INTO utilisateurs (email, mot_de_passe_hash, role, prenom, nom)
VALUES
-- 5 demo nommés
('user@Leon.local',            '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Utilisateur', 'Demo'),
('sarah.clark@Leon.local',     '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Sarah',       'Clark'),
('marc.roy@Leon.local',        '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Marc',        'Roy'),
('lina.nguyen@Leon.local',     '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Lina',        'Nguyen'),
('adam.fournier@Leon.local',   '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Adam',        'Fournier'),
-- 15 nouveaux clients (profils financiers variés, francophones QC/ON)
('olivier.tremblay@Leon.local','$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Olivier',     'Tremblay'),
('sophie.bergeron@Leon.local', '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Sophie',      'Bergeron'),
('thomas.girard@Leon.local',   '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Thomas',      'Girard'),
('isabelle.morin@Leon.local',  '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Isabelle',    'Morin'),
('julien.cote@Leon.local',     '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Julien',      'Côté'),
('camille.lefebvre@Leon.local','$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Camille',     'Lefebvre'),
('alexandre.gagne@Leon.local', '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Alexandre',   'Gagné'),
('jade.bouchard@Leon.local',   '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Jade',        'Bouchard'),
('raphael.pelletier@Leon.local','$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa','UTILISATEUR', 'Raphaël',     'Pelletier'),
('lea.caron@Leon.local',       '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Léa',         'Caron'),
('noah.dubois@Leon.local',     '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Noah',        'Dubois'),
('rosalie.desjardins@Leon.local','$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa','UTILISATEUR','Rosalie',     'Desjardins'),
('samuel.leblanc@Leon.local',  '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Samuel',      'Leblanc'),
('chloe.pepin@Leon.local',     '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Chloé',       'Pépin'),
('vincent.lapointe@Leon.local','$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Vincent',     'Lapointe'),
('emma.gagnon@Leon.local',     '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'Emma',        'Gagnon'),
('david.moreau@Leon.local',    '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'UTILISATEUR', 'David',       'Moreau'),
-- 2 modérateurs
('mod1@Leon.local',            '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'MODERATEUR',  'Mila',        'Stone'),
('mod2@Leon.local',            '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'MODERATEUR',  'Nina',        'West');

-- Variables utilisateur (demo)
SET @u_demo     := (SELECT id FROM utilisateurs WHERE email = 'user@Leon.local'            LIMIT 1);
SET @u_sarah    := (SELECT id FROM utilisateurs WHERE email = 'sarah.clark@Leon.local'     LIMIT 1);
SET @u_marc     := (SELECT id FROM utilisateurs WHERE email = 'marc.roy@Leon.local'        LIMIT 1);
SET @u_lina     := (SELECT id FROM utilisateurs WHERE email = 'lina.nguyen@Leon.local'     LIMIT 1);
SET @u_adam     := (SELECT id FROM utilisateurs WHERE email = 'adam.fournier@Leon.local'   LIMIT 1);
SET @u_olivier  := (SELECT id FROM utilisateurs WHERE email = 'olivier.tremblay@Leon.local' LIMIT 1);
SET @u_sophie   := (SELECT id FROM utilisateurs WHERE email = 'sophie.bergeron@Leon.local' LIMIT 1);
SET @u_thomas   := (SELECT id FROM utilisateurs WHERE email = 'thomas.girard@Leon.local'   LIMIT 1);
SET @u_isabelle := (SELECT id FROM utilisateurs WHERE email = 'isabelle.morin@Leon.local'  LIMIT 1);
SET @u_julien   := (SELECT id FROM utilisateurs WHERE email = 'julien.cote@Leon.local'     LIMIT 1);
SET @u_camille  := (SELECT id FROM utilisateurs WHERE email = 'camille.lefebvre@Leon.local' LIMIT 1);
SET @u_alex     := (SELECT id FROM utilisateurs WHERE email = 'alexandre.gagne@Leon.local' LIMIT 1);
SET @u_jade     := (SELECT id FROM utilisateurs WHERE email = 'jade.bouchard@Leon.local'   LIMIT 1);
SET @u_raphael  := (SELECT id FROM utilisateurs WHERE email = 'raphael.pelletier@Leon.local' LIMIT 1);
SET @u_lea      := (SELECT id FROM utilisateurs WHERE email = 'lea.caron@Leon.local'       LIMIT 1);
SET @u_noah     := (SELECT id FROM utilisateurs WHERE email = 'noah.dubois@Leon.local'     LIMIT 1);
SET @u_rosalie  := (SELECT id FROM utilisateurs WHERE email = 'rosalie.desjardins@Leon.local' LIMIT 1);
SET @u_samuel   := (SELECT id FROM utilisateurs WHERE email = 'samuel.leblanc@Leon.local'  LIMIT 1);
SET @u_chloe    := (SELECT id FROM utilisateurs WHERE email = 'chloe.pepin@Leon.local'     LIMIT 1);
SET @u_vincent  := (SELECT id FROM utilisateurs WHERE email = 'vincent.lapointe@Leon.local' LIMIT 1);
SET @u_emma     := (SELECT id FROM utilisateurs WHERE email = 'emma.gagnon@Leon.local'     LIMIT 1);
SET @u_david    := (SELECT id FROM utilisateurs WHERE email = 'david.moreau@Leon.local'    LIMIT 1);
SET @u_mod1     := (SELECT id FROM utilisateurs WHERE email = 'mod1@Leon.local'            LIMIT 1);
SET @u_mod2     := (SELECT id FROM utilisateurs WHERE email = 'mod2@Leon.local'            LIMIT 1);

-- ------------------------------------------------------------
-- CLIENTS (22 : tous liés à un utilisateur)
-- CLIENTS
-- ------------------------------------------------------------
INSERT INTO clients (prenom, nom, email_fictif, ville)
VALUES
('Client',    'Utilisateur', 'client-user@Leon.local',       'Ottawa'),
('Sarah',     'Clark',       'sarah.client@Leon.local',      'Montréal'),
('Marc',      'Roy',         'marc.client@Leon.local',       'Québec'),
('Lina',      'Nguyen',      'lina.client@Leon.local',       'Toronto'),
('Adam',      'Fournier',    'adam.client@Leon.local',       'Sherbrooke'),
('Olivier',   'Tremblay',    'olivier.client@Leon.local',    'Québec'),
('Sophie',    'Bergeron',    'sophie.client@Leon.local',     'Montréal'),
('Thomas',    'Girard',      'thomas.client@Leon.local',     'Sherbrooke'),
('Isabelle',  'Morin',       'isabelle.client@Leon.local',   'Gatineau'),
('Julien',    'Côté',        'julien.client@Leon.local',     'Ottawa'),
('Camille',   'Lefebvre',    'camille.client@Leon.local',    'Trois-Rivières'),
('Alexandre', 'Gagné',       'alexandre.client@Leon.local',  'Québec'),
('Jade',      'Bouchard',    'jade.client@Leon.local',       'Saguenay'),
('Raphaël',   'Pelletier',   'raphael.client@Leon.local',    'Laval'),
('Léa',       'Caron',       'lea.client@Leon.local',        'Longueuil'),
('Noah',      'Dubois',      'noah.client@Leon.local',       'Kingston'),
('Rosalie',   'Desjardins',  'rosalie.client@Leon.local',    'Drummondville'),
('Samuel',    'Leblanc',     'samuel.client@Leon.local',     'Montréal'),
('Chloé',     'Pépin',       'chloe.client@Leon.local',      'Rimouski'),
('Vincent',   'Lapointe',    'vincent.client@Leon.local',    'Québec'),
-- Les 22 clients sont tous rattachés à un utilisateur (emma / david rajoutés à la liste des utilisateurs)
('Emma',      'Gagnon',      'emma.client@Leon.local',       'Laval'),
('David',     'Moreau',      'david.client@Leon.local',      'Ottawa');

SET @c_demo     := (SELECT id FROM clients WHERE email_fictif = 'client-user@Leon.local'     LIMIT 1);
SET @c_sarah    := (SELECT id FROM clients WHERE email_fictif = 'sarah.client@Leon.local'    LIMIT 1);
SET @c_marc     := (SELECT id FROM clients WHERE email_fictif = 'marc.client@Leon.local'     LIMIT 1);
SET @c_lina     := (SELECT id FROM clients WHERE email_fictif = 'lina.client@Leon.local'     LIMIT 1);
SET @c_adam     := (SELECT id FROM clients WHERE email_fictif = 'adam.client@Leon.local'     LIMIT 1);
SET @c_olivier  := (SELECT id FROM clients WHERE email_fictif = 'olivier.client@Leon.local'  LIMIT 1);
SET @c_sophie   := (SELECT id FROM clients WHERE email_fictif = 'sophie.client@Leon.local'   LIMIT 1);
SET @c_thomas   := (SELECT id FROM clients WHERE email_fictif = 'thomas.client@Leon.local'   LIMIT 1);
SET @c_isabelle := (SELECT id FROM clients WHERE email_fictif = 'isabelle.client@Leon.local' LIMIT 1);
SET @c_julien   := (SELECT id FROM clients WHERE email_fictif = 'julien.client@Leon.local'   LIMIT 1);
SET @c_camille  := (SELECT id FROM clients WHERE email_fictif = 'camille.client@Leon.local'  LIMIT 1);
SET @c_alex     := (SELECT id FROM clients WHERE email_fictif = 'alexandre.client@Leon.local' LIMIT 1);
SET @c_jade     := (SELECT id FROM clients WHERE email_fictif = 'jade.client@Leon.local'     LIMIT 1);
SET @c_raphael  := (SELECT id FROM clients WHERE email_fictif = 'raphael.client@Leon.local'  LIMIT 1);
SET @c_lea      := (SELECT id FROM clients WHERE email_fictif = 'lea.client@Leon.local'      LIMIT 1);
SET @c_noah     := (SELECT id FROM clients WHERE email_fictif = 'noah.client@Leon.local'     LIMIT 1);
SET @c_rosalie  := (SELECT id FROM clients WHERE email_fictif = 'rosalie.client@Leon.local'  LIMIT 1);
SET @c_samuel   := (SELECT id FROM clients WHERE email_fictif = 'samuel.client@Leon.local'   LIMIT 1);
SET @c_chloe    := (SELECT id FROM clients WHERE email_fictif = 'chloe.client@Leon.local'    LIMIT 1);
SET @c_vincent  := (SELECT id FROM clients WHERE email_fictif = 'vincent.client@Leon.local'  LIMIT 1);
SET @c_emma     := (SELECT id FROM clients WHERE email_fictif = 'emma.client@Leon.local'     LIMIT 1);
SET @c_david    := (SELECT id FROM clients WHERE email_fictif = 'david.client@Leon.local'    LIMIT 1);

-- ------------------------------------------------------------
-- LIAISONS utilisateurs <-> clients (22 liaisons : tous les clients sont rattachés)
-- LIAISONS UTILISATEURS <-> CLIENTS
-- ------------------------------------------------------------
INSERT INTO utilisateurs_clients (utilisateur_id, client_id)
VALUES
(@u_demo, @c_demo), (@u_sarah, @c_sarah), (@u_marc, @c_marc), (@u_lina, @c_lina), (@u_adam, @c_adam),
(@u_olivier, @c_olivier), (@u_sophie, @c_sophie), (@u_thomas, @c_thomas), (@u_isabelle, @c_isabelle),
(@u_julien, @c_julien), (@u_camille, @c_camille), (@u_alex, @c_alex), (@u_jade, @c_jade),
(@u_raphael, @c_raphael), (@u_lea, @c_lea), (@u_noah, @c_noah), (@u_rosalie, @c_rosalie),
(@u_samuel, @c_samuel), (@u_chloe, @c_chloe), (@u_vincent, @c_vincent),
(@u_emma, @c_emma), (@u_david, @c_david);

-- ============================================================
-- COMPTES BANCAIRES
--
-- La colonne `solde` correspond EXACTEMENT à la somme des
-- transactions `TERMINEE` qui seront insérées pour ce compte.
-- Voir plus bas pour le détail ligne par ligne.
-- ============================================================
INSERT INTO comptes (client_id, type_compte, numero_compte, numero_institution, numero_transit, swift_bic, solde, devise, est_actif)
VALUES
-- ── DEMO (demo_cheques, demo_epargne, demo_credit)
-- cheques : +18000 (ouverture) +5200×3 (salaires) −1000×3 (virements) −145.60 (Hydro) −200 (retrait) = 30254.40
-- epargne : +55000 (ouverture) +1000×3 (virements entrants) = 58000.00
-- credit  : +3000 (solde initial outstanding)
(@c_demo, 'CHEQUES', '4821 3390 4521', '621', '10482', 'NXBKCA2TXXX', 30254.40, 'CAD', 1),
(@c_demo, 'EPARGNE', '4821 3390 8834', '621', '10482', 'NXBKCA2TXXX', 58000.00, 'CAD', 1),
(@c_demo, 'CREDIT',  '4821 3390 9902', '621', '10482', 'NXBKCA2TXXX',  3000.00, 'CAD', 1),

-- ── SARAH
-- cheques : +6000 +3400×3 −400×3 −118.42 −150 = 14731.58
-- epargne : +18000 +400×3 = 19200
-- credit  : +800
(@c_sarah, 'CHEQUES', '6214 8820 1104', '621', '23815', 'NXBKCA2TXXX', 14731.58, 'CAD', 1),
(@c_sarah, 'EPARGNE', '6214 8820 1105', '621', '23815', 'NXBKCA2TXXX', 19200.00, 'CAD', 1),
(@c_sarah, 'CREDIT',  '6214 8820 1106', '621', '23815', 'NXBKCA2TXXX',   800.00, 'CAD', 1),

-- ── MARC
-- cheques : +4500 +2600×3 −250×3 −100 = 11450
-- epargne : +12000 +250×3 = 12750
-- credit  : +1200
(@c_marc, 'CHEQUES', '3392 7741 2204', '621', '34729', 'NXBKCA2TXXX', 11450.00, 'CAD', 1),
(@c_marc, 'EPARGNE', '3392 7741 2205', '621', '34729', 'NXBKCA2TXXX', 12750.00, 'CAD', 1),
(@c_marc, 'CREDIT',  '3392 7741 2206', '621', '34729', 'NXBKCA2TXXX',  1200.00, 'CAD', 1),

-- ── LINA
-- cheques : +10000 +4850×3 −600×3 −420 −300 = 22030
-- epargne : +40000 +600×3 = 41800
-- credit  : +980.15
(@c_lina, 'CHEQUES', '7758 1193 3304', '621', '45103', 'NXBKCA2TXXX', 22030.00, 'CAD', 1),
(@c_lina, 'EPARGNE', '7758 1193 3305', '621', '45103', 'NXBKCA2TXXX', 41800.00, 'CAD', 1),
(@c_lina, 'CREDIT',  '7758 1193 3306', '621', '45103', 'NXBKCA2TXXX',   980.15, 'CAD', 1),

-- ── ADAM
-- cheques : +4000 +2750×3 −300×3 −133.90 −150 = 11066.10
-- epargne : +6000 +300×3 = 6900
(@c_adam, 'CHEQUES', '2241 6604 4404', '621', '56817', 'NXBKCA2TXXX', 11066.10, 'CAD', 1),
(@c_adam, 'EPARGNE', '2241 6604 4405', '621', '56817', 'NXBKCA2TXXX',  6900.00, 'CAD', 1),

-- ── Olivier (jeune actif — 2 comptes, activité modérée)
-- cheques : +3500 +2200 (salaire) −89.50 (facture) = 5610.50
-- epargne : +2500 (ouverture seule)
(@c_olivier, 'CHEQUES', '1104 5582 7731', '621', '78423', 'NXBKCA2TXXX', 5610.50, 'CAD', 1),
(@c_olivier, 'EPARGNE', '1104 5582 7732', '621', '78423', 'NXBKCA2TXXX', 2500.00, 'CAD', 1),

-- ── Sophie (jeune actif, 3 comptes)
-- cheques : +7000 +2900 −60.15 = 9839.85
-- epargne : +22000
-- credit  : +420
(@c_sophie, 'CHEQUES', '3398 1127 6645', '621', '12088', 'NXBKCA2TXXX',  9839.85, 'CAD', 1),
(@c_sophie, 'EPARGNE', '3398 1127 6646', '621', '12088', 'NXBKCA2TXXX', 22000.00, 'CAD', 1),
(@c_sophie, 'CREDIT',  '3398 1127 6647', '621', '12088', 'NXBKCA2TXXX',   420.00, 'CAD', 1),

-- ── Thomas (étudiant, 1 compte)
-- cheques : +1200 (bourse d'études)
(@c_thomas, 'CHEQUES', '9921 4407 5531', '621', '23344', 'NXBKCA2TXXX', 1200.00, 'CAD', 1),

-- ── Isabelle (senior, 2 comptes)
-- cheques : +12000
-- epargne : +45000
(@c_isabelle, 'CHEQUES', '5512 6630 8841', '621', '34112', 'NXBKCA2TXXX', 12000.00, 'CAD', 1),
(@c_isabelle, 'EPARGNE', '5512 6630 8842', '621', '34112', 'NXBKCA2TXXX', 45000.00, 'CAD', 1),

-- ── Julien (famille, 3 comptes)
-- cheques : +5800 +2400 = 8200
-- epargne : +8200
-- credit  : +650
(@c_julien, 'CHEQUES', '7741 2288 9934', '621', '45523', 'NXBKCA2TXXX', 8200.00, 'CAD', 1),
(@c_julien, 'EPARGNE', '7741 2288 9935', '621', '45523', 'NXBKCA2TXXX', 8200.00, 'CAD', 1),
(@c_julien, 'CREDIT',  '7741 2288 9936', '621', '45523', 'NXBKCA2TXXX',  650.00, 'CAD', 1),

-- ── Camille (1 compte)
-- cheques : +3200
(@c_camille, 'CHEQUES', '2208 9914 3345', '621', '56231', 'NXBKCA2TXXX', 3200.00, 'CAD', 1),

-- ── Alexandre (pro, 3 comptes)
-- cheques : +16000 +4100 −320 = 19780
-- epargne : +72000
-- credit  : +1850
(@c_alex, 'CHEQUES', '8834 2277 5011', '621', '67902', 'NXBKCA2TXXX', 19780.00, 'CAD', 1),
(@c_alex, 'EPARGNE', '8834 2277 5012', '621', '67902', 'NXBKCA2TXXX', 72000.00, 'CAD', 1),
(@c_alex, 'CREDIT',  '8834 2277 5013', '621', '67902', 'NXBKCA2TXXX',  1850.00, 'CAD', 1),

-- ── Jade (jeune actif, 2 comptes)
-- cheques : +4400
-- epargne : +11000
(@c_jade, 'CHEQUES', '4471 8833 2109', '621', '78814', 'NXBKCA2TXXX',  4400.00, 'CAD', 1),
(@c_jade, 'EPARGNE', '4471 8833 2110', '621', '78814', 'NXBKCA2TXXX', 11000.00, 'CAD', 1),

-- ── Raphaël (étudiant, 1 compte)
-- cheques : +2100
(@c_raphael, 'CHEQUES', '6602 1189 7734', '621', '89201', 'NXBKCA2TXXX', 2100.00, 'CAD', 1),

-- ── Léa (famille, 3 comptes)
-- cheques : +7800 +3100 −215.40 = 10684.60
-- epargne : +14500
-- credit  : +540
(@c_lea, 'CHEQUES', '3319 7752 4408', '621', '90123', 'NXBKCA2TXXX', 10684.60, 'CAD', 1),
(@c_lea, 'EPARGNE', '3319 7752 4409', '621', '90123', 'NXBKCA2TXXX', 14500.00, 'CAD', 1),
(@c_lea, 'CREDIT',  '3319 7752 4410', '621', '90123', 'NXBKCA2TXXX',   540.00, 'CAD', 1),

-- ── Noah (étudiant, 1 compte)
-- cheques : +950
(@c_noah, 'CHEQUES', '1188 5506 9923', '621', '10987', 'NXBKCA2TXXX', 950.00, 'CAD', 1),

-- ── Rosalie (famille, 2 comptes)
-- cheques : +11500
-- epargne : +38000
(@c_rosalie, 'CHEQUES', '5527 8811 6640', '621', '21098', 'NXBKCA2TXXX', 11500.00, 'CAD', 1),
(@c_rosalie, 'EPARGNE', '5527 8811 6641', '621', '21098', 'NXBKCA2TXXX', 38000.00, 'CAD', 1),

-- ── Samuel (jeune actif, 2 comptes)
-- cheques : +6400
-- epargne : +9800
(@c_samuel, 'CHEQUES', '9902 3377 1154', '621', '32109', 'NXBKCA2TXXX', 6400.00, 'CAD', 1),
(@c_samuel, 'EPARGNE', '9902 3377 1155', '621', '32109', 'NXBKCA2TXXX', 9800.00, 'CAD', 1),

-- ── Chloé (senior, 2 comptes)
-- cheques : +4800
-- epargne : +125000
(@c_chloe, 'CHEQUES', '2214 6670 8890', '621', '43098', 'NXBKCA2TXXX',   4800.00, 'CAD', 1),
(@c_chloe, 'EPARGNE', '2214 6670 8891', '621', '43098', 'NXBKCA2TXXX', 125000.00, 'CAD', 1),

-- ── Vincent (pro haut de gamme, 3 comptes)
-- cheques : +22000
-- epargne : +95000
-- credit  : +2400
(@c_vincent, 'CHEQUES', '7755 1108 3321', '621', '54092', 'NXBKCA2TXXX', 22000.00, 'CAD', 1),
(@c_vincent, 'EPARGNE', '7755 1108 3322', '621', '54092', 'NXBKCA2TXXX', 95000.00, 'CAD', 1),
(@c_vincent, 'CREDIT',  '7755 1108 3323', '621', '54092', 'NXBKCA2TXXX',  2400.00, 'CAD', 1),

-- ── Emma (non liée, 3 comptes — créés par un modérateur)
(@c_emma, 'CHEQUES', '5563 9927 5504', '621', '67234', 'NXBKCA2TXXX',  5400.00, 'CAD', 1),
(@c_emma, 'EPARGNE', '5563 9927 5505', '621', '67234', 'NXBKCA2TXXX', 15000.00, 'CAD', 1),
(@c_emma, 'CREDIT',  '5563 9927 5506', '621', '67234', 'NXBKCA2TXXX',   410.60, 'CAD', 1),

-- ── David (non lié, 1 compte)
(@c_david, 'CHEQUES', '8891 2203 4476', '621', '78320', 'NXBKCA2TXXX', 8900.00, 'CAD', 1);

-- ------------------------------------------------------------
-- Variables comptes (pour les INSERT suivants)
-- ------------------------------------------------------------
SET @demo_cheques     := (SELECT id FROM comptes WHERE client_id = @c_demo     AND type_compte = 'CHEQUES' LIMIT 1);
SET @demo_epargne     := (SELECT id FROM comptes WHERE client_id = @c_demo     AND type_compte = 'EPARGNE' LIMIT 1);
SET @demo_credit      := (SELECT id FROM comptes WHERE client_id = @c_demo     AND type_compte = 'CREDIT'  LIMIT 1);
SET @sarah_cheques    := (SELECT id FROM comptes WHERE client_id = @c_sarah    AND type_compte = 'CHEQUES' LIMIT 1);
SET @sarah_epargne    := (SELECT id FROM comptes WHERE client_id = @c_sarah    AND type_compte = 'EPARGNE' LIMIT 1);
SET @sarah_credit     := (SELECT id FROM comptes WHERE client_id = @c_sarah    AND type_compte = 'CREDIT'  LIMIT 1);
SET @marc_cheques     := (SELECT id FROM comptes WHERE client_id = @c_marc     AND type_compte = 'CHEQUES' LIMIT 1);
SET @marc_epargne     := (SELECT id FROM comptes WHERE client_id = @c_marc     AND type_compte = 'EPARGNE' LIMIT 1);
SET @marc_credit      := (SELECT id FROM comptes WHERE client_id = @c_marc     AND type_compte = 'CREDIT'  LIMIT 1);
SET @lina_cheques     := (SELECT id FROM comptes WHERE client_id = @c_lina     AND type_compte = 'CHEQUES' LIMIT 1);
SET @lina_epargne     := (SELECT id FROM comptes WHERE client_id = @c_lina     AND type_compte = 'EPARGNE' LIMIT 1);
SET @lina_credit      := (SELECT id FROM comptes WHERE client_id = @c_lina     AND type_compte = 'CREDIT'  LIMIT 1);
SET @adam_cheques     := (SELECT id FROM comptes WHERE client_id = @c_adam     AND type_compte = 'CHEQUES' LIMIT 1);
SET @adam_epargne     := (SELECT id FROM comptes WHERE client_id = @c_adam     AND type_compte = 'EPARGNE' LIMIT 1);
SET @olivier_cheques  := (SELECT id FROM comptes WHERE client_id = @c_olivier  AND type_compte = 'CHEQUES' LIMIT 1);
SET @olivier_epargne  := (SELECT id FROM comptes WHERE client_id = @c_olivier  AND type_compte = 'EPARGNE' LIMIT 1);
SET @sophie_cheques   := (SELECT id FROM comptes WHERE client_id = @c_sophie   AND type_compte = 'CHEQUES' LIMIT 1);
SET @sophie_epargne   := (SELECT id FROM comptes WHERE client_id = @c_sophie   AND type_compte = 'EPARGNE' LIMIT 1);
SET @sophie_credit    := (SELECT id FROM comptes WHERE client_id = @c_sophie   AND type_compte = 'CREDIT'  LIMIT 1);
SET @thomas_cheques   := (SELECT id FROM comptes WHERE client_id = @c_thomas   AND type_compte = 'CHEQUES' LIMIT 1);
SET @isabelle_cheques := (SELECT id FROM comptes WHERE client_id = @c_isabelle AND type_compte = 'CHEQUES' LIMIT 1);
SET @isabelle_epargne := (SELECT id FROM comptes WHERE client_id = @c_isabelle AND type_compte = 'EPARGNE' LIMIT 1);
SET @julien_cheques   := (SELECT id FROM comptes WHERE client_id = @c_julien   AND type_compte = 'CHEQUES' LIMIT 1);
SET @julien_epargne   := (SELECT id FROM comptes WHERE client_id = @c_julien   AND type_compte = 'EPARGNE' LIMIT 1);
SET @julien_credit    := (SELECT id FROM comptes WHERE client_id = @c_julien   AND type_compte = 'CREDIT'  LIMIT 1);
SET @camille_cheques  := (SELECT id FROM comptes WHERE client_id = @c_camille  AND type_compte = 'CHEQUES' LIMIT 1);
SET @alex_cheques     := (SELECT id FROM comptes WHERE client_id = @c_alex     AND type_compte = 'CHEQUES' LIMIT 1);
SET @alex_epargne     := (SELECT id FROM comptes WHERE client_id = @c_alex     AND type_compte = 'EPARGNE' LIMIT 1);
SET @alex_credit      := (SELECT id FROM comptes WHERE client_id = @c_alex     AND type_compte = 'CREDIT'  LIMIT 1);
SET @jade_cheques     := (SELECT id FROM comptes WHERE client_id = @c_jade     AND type_compte = 'CHEQUES' LIMIT 1);
SET @jade_epargne     := (SELECT id FROM comptes WHERE client_id = @c_jade     AND type_compte = 'EPARGNE' LIMIT 1);
SET @raphael_cheques  := (SELECT id FROM comptes WHERE client_id = @c_raphael  AND type_compte = 'CHEQUES' LIMIT 1);
SET @lea_cheques      := (SELECT id FROM comptes WHERE client_id = @c_lea      AND type_compte = 'CHEQUES' LIMIT 1);
SET @lea_epargne      := (SELECT id FROM comptes WHERE client_id = @c_lea      AND type_compte = 'EPARGNE' LIMIT 1);
SET @lea_credit       := (SELECT id FROM comptes WHERE client_id = @c_lea      AND type_compte = 'CREDIT'  LIMIT 1);
SET @noah_cheques     := (SELECT id FROM comptes WHERE client_id = @c_noah     AND type_compte = 'CHEQUES' LIMIT 1);
SET @rosalie_cheques  := (SELECT id FROM comptes WHERE client_id = @c_rosalie  AND type_compte = 'CHEQUES' LIMIT 1);
SET @rosalie_epargne  := (SELECT id FROM comptes WHERE client_id = @c_rosalie  AND type_compte = 'EPARGNE' LIMIT 1);
SET @samuel_cheques   := (SELECT id FROM comptes WHERE client_id = @c_samuel   AND type_compte = 'CHEQUES' LIMIT 1);
SET @samuel_epargne   := (SELECT id FROM comptes WHERE client_id = @c_samuel   AND type_compte = 'EPARGNE' LIMIT 1);
SET @chloe_cheques    := (SELECT id FROM comptes WHERE client_id = @c_chloe    AND type_compte = 'CHEQUES' LIMIT 1);
SET @chloe_epargne    := (SELECT id FROM comptes WHERE client_id = @c_chloe    AND type_compte = 'EPARGNE' LIMIT 1);
SET @vincent_cheques  := (SELECT id FROM comptes WHERE client_id = @c_vincent  AND type_compte = 'CHEQUES' LIMIT 1);
SET @vincent_epargne  := (SELECT id FROM comptes WHERE client_id = @c_vincent  AND type_compte = 'EPARGNE' LIMIT 1);
SET @vincent_credit   := (SELECT id FROM comptes WHERE client_id = @c_vincent  AND type_compte = 'CREDIT'  LIMIT 1);
SET @emma_cheques     := (SELECT id FROM comptes WHERE client_id = @c_emma     AND type_compte = 'CHEQUES' LIMIT 1);
SET @emma_epargne     := (SELECT id FROM comptes WHERE client_id = @c_emma     AND type_compte = 'EPARGNE' LIMIT 1);
SET @emma_credit      := (SELECT id FROM comptes WHERE client_id = @c_emma     AND type_compte = 'CREDIT'  LIMIT 1);
SET @david_cheques    := (SELECT id FROM comptes WHERE client_id = @c_david    AND type_compte = 'CHEQUES' LIMIT 1);

-- ============================================================
-- TRANSACTIONS
-- Règle d'or : la somme des montants par compte == comptes.solde
-- ============================================================
INSERT INTO transactions (compte_id, type_transaction, description, montant, statut, date_transaction)
VALUES
-- ╔════════════════════════════════════════════════════════╗
-- ║  DEMO — CHEQUES (total attendu : 30254.40)             ║
-- ╚════════════════════════════════════════════════════════╝
(@demo_cheques, 'DEPOT',    'Ouverture de compte — dépôt initial', 18000.00, 'TERMINEE', '2025-11-01 09:00:00'),
(@demo_cheques, 'DEPOT',    'Salaire mensuel',                      5200.00, 'TERMINEE', '2025-12-15 09:00:00'),
(@demo_cheques, 'DEPOT',    'Salaire mensuel',                      5200.00, 'TERMINEE', '2026-01-15 09:00:00'),
(@demo_cheques, 'DEPOT',    'Salaire mensuel',                      5200.00, 'TERMINEE', '2026-02-15 09:00:00'),
(@demo_cheques, 'VIREMENT', 'Virement interne #V1 (sortant)',      -1000.00, 'TERMINEE', '2025-12-20 11:30:00'),
(@demo_cheques, 'VIREMENT', 'Virement interne #V2 (sortant)',      -1000.00, 'TERMINEE', '2026-01-20 11:30:00'),
(@demo_cheques, 'VIREMENT', 'Virement interne #V3 (sortant)',      -1000.00, 'TERMINEE', '2026-02-10 11:30:00'),
(@demo_cheques, 'PAIEMENT', 'Facture Hydro Ottawa',                 -145.60, 'TERMINEE', '2026-01-28 09:00:00'),
(@demo_cheques, 'RETRAIT',  'Retrait guichet centre-ville',         -200.00, 'TERMINEE', '2026-02-10 15:15:00'),
-- DEMO — EPARGNE (total attendu : 58000.00)
(@demo_epargne, 'DEPOT',    'Ouverture de compte — dépôt initial', 55000.00, 'TERMINEE', '2025-11-01 09:00:00'),
(@demo_epargne, 'VIREMENT', 'Virement interne #V1 (entrant)',       1000.00, 'TERMINEE', '2025-12-20 11:30:00'),
(@demo_epargne, 'VIREMENT', 'Virement interne #V2 (entrant)',       1000.00, 'TERMINEE', '2026-01-20 11:30:00'),
(@demo_epargne, 'VIREMENT', 'Virement interne #V3 (entrant)',       1000.00, 'TERMINEE', '2026-02-10 11:30:00'),
-- DEMO — CREDIT (total attendu : 3000.00)
(@demo_credit,  'DEPOT',    'Ouverture — solde initial',            3000.00, 'TERMINEE', '2025-11-01 09:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  SARAH — CHEQUES (total attendu : 14731.58)            ║
-- ╚════════════════════════════════════════════════════════╝
(@sarah_cheques, 'DEPOT',    'Ouverture de compte — dépôt initial', 6000.00, 'TERMINEE', '2025-11-05 10:00:00'),
(@sarah_cheques, 'DEPOT',    'Salaire mensuel',                     3400.00, 'TERMINEE', '2025-12-12 09:00:00'),
(@sarah_cheques, 'DEPOT',    'Salaire mensuel',                     3400.00, 'TERMINEE', '2026-01-12 09:00:00'),
(@sarah_cheques, 'DEPOT',    'Salaire mensuel',                     3400.00, 'TERMINEE', '2026-02-12 09:00:00'),
(@sarah_cheques, 'VIREMENT', 'Virement vers épargne (sortant)',     -400.00, 'TERMINEE', '2025-12-18 20:00:00'),
(@sarah_cheques, 'VIREMENT', 'Virement vers épargne (sortant)',     -400.00, 'TERMINEE', '2026-01-18 20:00:00'),
(@sarah_cheques, 'VIREMENT', 'Virement vers épargne (sortant)',     -400.00, 'TERMINEE', '2026-02-11 20:00:00'),
(@sarah_cheques, 'PAIEMENT', 'Facture Hydro Québec',                -118.42, 'TERMINEE', '2026-02-12 12:45:00'),
(@sarah_cheques, 'RETRAIT',  'Retrait guichet Plateau',             -150.00, 'TERMINEE', '2026-02-14 18:00:00'),
-- SARAH — EPARGNE (total attendu : 19200.00)
(@sarah_epargne, 'DEPOT',    'Ouverture de compte — dépôt initial', 18000.00, 'TERMINEE', '2025-11-05 10:00:00'),
(@sarah_epargne, 'VIREMENT', 'Virement depuis chèques (entrant)',     400.00, 'TERMINEE', '2025-12-18 20:00:00'),
(@sarah_epargne, 'VIREMENT', 'Virement depuis chèques (entrant)',     400.00, 'TERMINEE', '2026-01-18 20:00:00'),
(@sarah_epargne, 'VIREMENT', 'Virement depuis chèques (entrant)',     400.00, 'TERMINEE', '2026-02-11 20:00:00'),
-- SARAH — CREDIT (total attendu : 800.00)
(@sarah_credit,  'DEPOT',    'Ouverture — solde initial',            800.00, 'TERMINEE', '2025-11-05 10:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  MARC — CHEQUES (total attendu : 11450.00)             ║
-- ╚════════════════════════════════════════════════════════╝
(@marc_cheques, 'DEPOT',    'Ouverture de compte — dépôt initial',  4500.00, 'TERMINEE', '2025-11-08 11:00:00'),
(@marc_cheques, 'DEPOT',    'Vente freelance',                      2600.00, 'TERMINEE', '2025-12-13 14:35:00'),
(@marc_cheques, 'DEPOT',    'Vente freelance',                      2600.00, 'TERMINEE', '2026-01-13 14:35:00'),
(@marc_cheques, 'DEPOT',    'Vente freelance',                      2600.00, 'TERMINEE', '2026-02-13 14:35:00'),
(@marc_cheques, 'VIREMENT', 'Épargne mensuelle (sortant)',          -250.00, 'TERMINEE', '2025-12-20 09:30:00'),
(@marc_cheques, 'VIREMENT', 'Épargne mensuelle (sortant)',          -250.00, 'TERMINEE', '2026-01-20 09:30:00'),
(@marc_cheques, 'VIREMENT', 'Épargne mensuelle (sortant)',          -250.00, 'TERMINEE', '2026-02-12 09:30:00'),
(@marc_cheques, 'RETRAIT',  'Distributeur quartier nord',           -100.00, 'TERMINEE', '2026-02-12 12:05:00'),
-- MARC — EPARGNE (total attendu : 12750.00)
(@marc_epargne, 'DEPOT',    'Ouverture de compte — dépôt initial', 12000.00, 'TERMINEE', '2025-11-08 11:00:00'),
(@marc_epargne, 'VIREMENT', 'Épargne mensuelle (entrant)',            250.00, 'TERMINEE', '2025-12-20 09:30:00'),
(@marc_epargne, 'VIREMENT', 'Épargne mensuelle (entrant)',            250.00, 'TERMINEE', '2026-01-20 09:30:00'),
(@marc_epargne, 'VIREMENT', 'Épargne mensuelle (entrant)',            250.00, 'TERMINEE', '2026-02-12 09:30:00'),
-- MARC — CREDIT (total attendu : 1200.00)
(@marc_credit,  'DEPOT',    'Ouverture — solde initial',            1200.00, 'TERMINEE', '2025-11-08 11:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  LINA — CHEQUES (total attendu : 22030.00)             ║
-- ╚════════════════════════════════════════════════════════╝
(@lina_cheques, 'DEPOT',    'Ouverture de compte — dépôt initial', 10000.00, 'TERMINEE', '2025-11-10 12:00:00'),
(@lina_cheques, 'DEPOT',    'Consultation informatique',            4850.00, 'TERMINEE', '2025-12-14 10:10:00'),
(@lina_cheques, 'DEPOT',    'Consultation informatique',            4850.00, 'TERMINEE', '2026-01-14 10:10:00'),
(@lina_cheques, 'DEPOT',    'Consultation informatique',            4850.00, 'TERMINEE', '2026-02-14 10:10:00'),
(@lina_cheques, 'VIREMENT', 'Fonds investissement (sortant)',       -600.00, 'TERMINEE', '2025-12-13 12:10:00'),
(@lina_cheques, 'VIREMENT', 'Fonds investissement (sortant)',       -600.00, 'TERMINEE', '2026-01-13 12:10:00'),
(@lina_cheques, 'VIREMENT', 'Fonds investissement (sortant)',       -600.00, 'TERMINEE', '2026-02-13 12:10:00'),
(@lina_cheques, 'PAIEMENT', 'Facture Air Canada — billet pro',      -420.00, 'TERMINEE', '2026-02-11 13:50:00'),
(@lina_cheques, 'RETRAIT',  'Retrait guichet Bay Street',           -300.00, 'TERMINEE', '2026-02-13 17:00:00'),
-- LINA — EPARGNE (total attendu : 41800.00)
(@lina_epargne, 'DEPOT',    'Ouverture de compte — dépôt initial', 40000.00, 'TERMINEE', '2025-11-10 12:00:00'),
(@lina_epargne, 'VIREMENT', 'Fonds investissement (entrant)',         600.00, 'TERMINEE', '2025-12-13 12:10:00'),
(@lina_epargne, 'VIREMENT', 'Fonds investissement (entrant)',         600.00, 'TERMINEE', '2026-01-13 12:10:00'),
(@lina_epargne, 'VIREMENT', 'Fonds investissement (entrant)',         600.00, 'TERMINEE', '2026-02-13 12:10:00'),
-- LINA — CREDIT (total attendu : 980.15)
(@lina_credit,  'DEPOT',    'Ouverture — solde initial',             980.15, 'TERMINEE', '2025-11-10 12:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  ADAM — CHEQUES (total attendu : 11066.10)             ║
-- ╚════════════════════════════════════════════════════════╝
(@adam_cheques, 'DEPOT',    'Ouverture de compte — dépôt initial',  4000.00, 'TERMINEE', '2025-11-15 08:20:00'),
(@adam_cheques, 'DEPOT',    'Salaire atelier',                      2750.00, 'TERMINEE', '2025-12-12 08:20:00'),
(@adam_cheques, 'DEPOT',    'Salaire atelier',                      2750.00, 'TERMINEE', '2026-01-12 08:20:00'),
(@adam_cheques, 'DEPOT',    'Salaire atelier',                      2750.00, 'TERMINEE', '2026-02-12 08:20:00'),
(@adam_cheques, 'VIREMENT', 'Épargne mensuelle (sortant)',          -300.00, 'TERMINEE', '2025-12-18 16:30:00'),
(@adam_cheques, 'VIREMENT', 'Épargne mensuelle (sortant)',          -300.00, 'TERMINEE', '2026-01-18 16:30:00'),
(@adam_cheques, 'VIREMENT', 'Épargne mensuelle (sortant)',          -300.00, 'TERMINEE', '2026-02-11 16:30:00'),
(@adam_cheques, 'PAIEMENT', 'Facture AssurAuto',                    -133.90, 'TERMINEE', '2026-02-15 10:00:00'),
(@adam_cheques, 'RETRAIT',  'Retrait guichet Sherbrooke',           -150.00, 'TERMINEE', '2026-02-16 17:30:00'),
-- ADAM — EPARGNE (total attendu : 6900.00)
(@adam_epargne, 'DEPOT',    'Ouverture de compte — dépôt initial',  6000.00, 'TERMINEE', '2025-11-15 08:20:00'),
(@adam_epargne, 'VIREMENT', 'Épargne mensuelle (entrant)',            300.00, 'TERMINEE', '2025-12-18 16:30:00'),
(@adam_epargne, 'VIREMENT', 'Épargne mensuelle (entrant)',            300.00, 'TERMINEE', '2026-01-18 16:30:00'),
(@adam_epargne, 'VIREMENT', 'Épargne mensuelle (entrant)',            300.00, 'TERMINEE', '2026-02-11 16:30:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  OLIVIER — CHEQUES (total attendu : 5610.50)           ║
-- ╚════════════════════════════════════════════════════════╝
(@olivier_cheques, 'DEPOT',    'Ouverture de compte — dépôt initial', 3500.00, 'TERMINEE', '2025-12-01 09:00:00'),
(@olivier_cheques, 'DEPOT',    'Salaire',                             2200.00, 'TERMINEE', '2026-02-15 09:00:00'),
(@olivier_cheques, 'PAIEMENT', 'Facture Hydro Québec',                 -89.50, 'TERMINEE', '2026-02-18 10:00:00'),
(@olivier_epargne, 'DEPOT',    'Ouverture de compte — dépôt initial', 2500.00, 'TERMINEE', '2025-12-01 09:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  SOPHIE — CHEQUES (total attendu : 9839.85)            ║
-- ╚════════════════════════════════════════════════════════╝
(@sophie_cheques, 'DEPOT',    'Ouverture de compte — dépôt initial', 7000.00, 'TERMINEE', '2025-11-20 10:30:00'),
(@sophie_cheques, 'DEPOT',    'Salaire marketing',                   2900.00, 'TERMINEE', '2026-02-14 09:00:00'),
(@sophie_cheques, 'PAIEMENT', 'Abonnement transport STM',             -60.15, 'TERMINEE', '2026-02-19 07:30:00'),
(@sophie_epargne, 'DEPOT',    'Ouverture de compte — dépôt initial', 22000.00, 'TERMINEE', '2025-11-20 10:30:00'),
(@sophie_credit,  'DEPOT',    'Ouverture — solde initial',            420.00, 'TERMINEE', '2025-11-20 10:30:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  THOMAS (étudiant) — CHEQUES (total : 1200.00)         ║
-- ╚════════════════════════════════════════════════════════╝
(@thomas_cheques, 'DEPOT', 'Bourse d''études — dépôt initial', 1200.00, 'TERMINEE', '2026-01-15 14:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  ISABELLE (senior) — 2 comptes                         ║
-- ╚════════════════════════════════════════════════════════╝
(@isabelle_cheques, 'DEPOT', 'Ouverture de compte — dépôt initial', 12000.00, 'TERMINEE', '2025-10-01 10:00:00'),
(@isabelle_epargne, 'DEPOT', 'Ouverture de compte — dépôt initial', 45000.00, 'TERMINEE', '2025-10-01 10:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  JULIEN — CHEQUES (total attendu : 8200.00)            ║
-- ╚════════════════════════════════════════════════════════╝
(@julien_cheques, 'DEPOT', 'Ouverture de compte — dépôt initial', 5800.00, 'TERMINEE', '2025-12-05 11:00:00'),
(@julien_cheques, 'DEPOT', 'Salaire',                             2400.00, 'TERMINEE', '2026-02-15 09:00:00'),
(@julien_epargne, 'DEPOT', 'Ouverture de compte — dépôt initial', 8200.00, 'TERMINEE', '2025-12-05 11:00:00'),
(@julien_credit,  'DEPOT', 'Ouverture — solde initial',            650.00, 'TERMINEE', '2025-12-05 11:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  CAMILLE — CHEQUES (total : 3200.00)                   ║
-- ╚════════════════════════════════════════════════════════╝
(@camille_cheques, 'DEPOT', 'Ouverture de compte — dépôt initial', 3200.00, 'TERMINEE', '2025-11-25 14:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  ALEXANDRE — CHEQUES (total attendu : 19780.00)        ║
-- ╚════════════════════════════════════════════════════════╝
(@alex_cheques, 'DEPOT',    'Ouverture de compte — dépôt initial', 16000.00, 'TERMINEE', '2025-09-15 10:00:00'),
(@alex_cheques, 'DEPOT',    'Honoraires consultation',              4100.00, 'TERMINEE', '2026-02-05 14:00:00'),
(@alex_cheques, 'PAIEMENT', 'Facture Rogers — forfait entreprise',  -320.00, 'TERMINEE', '2026-02-16 11:00:00'),
(@alex_epargne, 'DEPOT',    'Ouverture de compte — dépôt initial', 72000.00, 'TERMINEE', '2025-09-15 10:00:00'),
(@alex_credit,  'DEPOT',    'Ouverture — solde initial',            1850.00, 'TERMINEE', '2025-09-15 10:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  JADE                                                   ║
-- ╚════════════════════════════════════════════════════════╝
(@jade_cheques, 'DEPOT', 'Ouverture de compte — dépôt initial',  4400.00, 'TERMINEE', '2025-12-15 10:00:00'),
(@jade_epargne, 'DEPOT', 'Ouverture de compte — dépôt initial', 11000.00, 'TERMINEE', '2025-12-15 10:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  RAPHAËL (étudiant)                                    ║
-- ╚════════════════════════════════════════════════════════╝
(@raphael_cheques, 'DEPOT', 'Ouverture de compte — dépôt initial', 2100.00, 'TERMINEE', '2026-01-20 09:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  LÉA — CHEQUES (total attendu : 10684.60)              ║
-- ╚════════════════════════════════════════════════════════╝
(@lea_cheques, 'DEPOT',    'Ouverture de compte — dépôt initial',  7800.00, 'TERMINEE', '2025-10-20 09:00:00'),
(@lea_cheques, 'DEPOT',    'Salaire',                              3100.00, 'TERMINEE', '2026-02-14 09:00:00'),
(@lea_cheques, 'PAIEMENT', 'Facture Condo Longueuil — charges',    -215.40, 'TERMINEE', '2026-02-20 10:00:00'),
(@lea_epargne, 'DEPOT',    'Ouverture de compte — dépôt initial', 14500.00, 'TERMINEE', '2025-10-20 09:00:00'),
(@lea_credit,  'DEPOT',    'Ouverture — solde initial',            540.00, 'TERMINEE', '2025-10-20 09:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  NOAH (étudiant)                                        ║
-- ╚════════════════════════════════════════════════════════╝
(@noah_cheques, 'DEPOT', 'Ouverture de compte — dépôt initial', 950.00, 'TERMINEE', '2026-02-01 10:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  ROSALIE                                                ║
-- ╚════════════════════════════════════════════════════════╝
(@rosalie_cheques, 'DEPOT', 'Ouverture de compte — dépôt initial', 11500.00, 'TERMINEE', '2025-11-12 11:00:00'),
(@rosalie_epargne, 'DEPOT', 'Ouverture de compte — dépôt initial', 38000.00, 'TERMINEE', '2025-11-12 11:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  SAMUEL                                                 ║
-- ╚════════════════════════════════════════════════════════╝
(@samuel_cheques, 'DEPOT', 'Ouverture de compte — dépôt initial', 6400.00, 'TERMINEE', '2025-12-08 12:00:00'),
(@samuel_epargne, 'DEPOT', 'Ouverture de compte — dépôt initial', 9800.00, 'TERMINEE', '2025-12-08 12:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  CHLOÉ (senior)                                        ║
-- ╚════════════════════════════════════════════════════════╝
(@chloe_cheques, 'DEPOT', 'Ouverture de compte — dépôt initial',   4800.00, 'TERMINEE', '2025-09-01 10:00:00'),
(@chloe_epargne, 'DEPOT', 'Ouverture de compte — dépôt initial', 125000.00, 'TERMINEE', '2025-09-01 10:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  VINCENT (pro haut de gamme)                           ║
-- ╚════════════════════════════════════════════════════════╝
(@vincent_cheques, 'DEPOT', 'Ouverture de compte — dépôt initial', 22000.00, 'TERMINEE', '2025-08-15 10:00:00'),
(@vincent_epargne, 'DEPOT', 'Ouverture de compte — dépôt initial', 95000.00, 'TERMINEE', '2025-08-15 10:00:00'),
(@vincent_credit,  'DEPOT', 'Ouverture — solde initial',            2400.00, 'TERMINEE', '2025-08-15 10:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  EMMA (non liée)                                        ║
-- ╚════════════════════════════════════════════════════════╝
(@emma_cheques, 'DEPOT', 'Ouverture de compte — dépôt initial',  5400.00, 'TERMINEE', '2025-12-01 10:00:00'),
(@emma_epargne, 'DEPOT', 'Ouverture de compte — dépôt initial', 15000.00, 'TERMINEE', '2025-12-01 10:00:00'),
(@emma_credit,  'DEPOT', 'Ouverture — solde initial',             410.60, 'TERMINEE', '2025-12-01 10:00:00'),

-- ╔════════════════════════════════════════════════════════╗
-- ║  DAVID (non lié)                                        ║
-- ╚════════════════════════════════════════════════════════╝
(@david_cheques, 'DEPOT', 'Ouverture de compte — dépôt initial', 8900.00, 'TERMINEE', '2025-11-22 13:00:00');

-- ============================================================
-- VIREMENTS
-- Chaque virement ACCEPTE correspond à une paire de transactions
-- VIREMENT déjà insérées ci-dessus (même date, même montant).
-- ============================================================
INSERT INTO virements (compte_source_id, compte_destination_id, montant, description, date_virement, statut)
VALUES
-- DEMO (3 virements mensuels)
(@demo_cheques, @demo_epargne, 1000.00, 'Transfert vers épargne principale', '2025-12-20 11:30:00', 'ACCEPTE'),
(@demo_cheques, @demo_epargne, 1000.00, 'Transfert vers épargne principale', '2026-01-20 11:30:00', 'ACCEPTE'),
(@demo_cheques, @demo_epargne, 1000.00, 'Transfert vers épargne principale', '2026-02-10 11:30:00', 'ACCEPTE'),
-- SARAH
(@sarah_cheques, @sarah_epargne, 400.00, 'Réserve vacances', '2025-12-18 20:00:00', 'ACCEPTE'),
(@sarah_cheques, @sarah_epargne, 400.00, 'Réserve vacances', '2026-01-18 20:00:00', 'ACCEPTE'),
(@sarah_cheques, @sarah_epargne, 400.00, 'Réserve vacances', '2026-02-11 20:00:00', 'ACCEPTE'),
-- MARC
(@marc_cheques, @marc_epargne, 250.00, 'Épargne mensuelle', '2025-12-20 09:30:00', 'ACCEPTE'),
(@marc_cheques, @marc_epargne, 250.00, 'Épargne mensuelle', '2026-01-20 09:30:00', 'ACCEPTE'),
(@marc_cheques, @marc_epargne, 250.00, 'Épargne mensuelle', '2026-02-12 09:30:00', 'ACCEPTE'),
-- LINA
(@lina_cheques, @lina_epargne, 600.00, 'Fonds investissement', '2025-12-13 12:10:00', 'ACCEPTE'),
(@lina_cheques, @lina_epargne, 600.00, 'Fonds investissement', '2026-01-13 12:10:00', 'ACCEPTE'),
(@lina_cheques, @lina_epargne, 600.00, 'Fonds investissement', '2026-02-13 12:10:00', 'ACCEPTE'),
-- ADAM
(@adam_cheques, @adam_epargne, 300.00, 'Épargne mensuelle', '2025-12-18 16:30:00', 'ACCEPTE'),
(@adam_cheques, @adam_epargne, 300.00, 'Épargne mensuelle', '2026-01-18 16:30:00', 'ACCEPTE'),
(@adam_cheques, @adam_epargne, 300.00, 'Épargne mensuelle', '2026-02-11 16:30:00', 'ACCEPTE');

-- ============================================================
-- FACTURES (30 factures : mix PAYEE / IMPAYEE / A_VENIR)
-- Les PAYEE correspondent à un PAIEMENT déjà enregistré dans transactions.
-- ============================================================
INSERT INTO factures
  (client_id, compte_paiement_id, fournisseur, reference_facture, description, montant, date_emission, date_echeance, statut, payee_le)
VALUES
-- DEMO (1 PAYEE + 2 pending)
(@c_demo, @demo_cheques, 'Hydro Ottawa',   'FAC-1001', 'Facture électricité janvier',   145.60, '2026-01-15', '2026-02-09', 'PAYEE',   '2026-01-28 09:00:00'),
(@c_demo, NULL,          'Bell Internet',  'FAC-1002', 'Internet fibre mars',            89.99, '2026-03-15', '2026-03-28', 'A_VENIR', NULL),
(@c_demo, NULL,          'Ville Ottawa',   'FAC-1003', 'Taxes municipales échéance 1', 320.00, '2026-02-20', '2026-03-05', 'IMPAYEE', NULL),
-- SARAH (1 PAYEE + 2 pending)
(@c_sarah, @sarah_cheques, 'Hydro Québec',     'FAC-2001', 'Électricité février',           118.42, '2026-02-01', '2026-02-18', 'PAYEE',   '2026-02-12 12:45:00'),
(@c_sarah, NULL,            'Vidéotron',        'FAC-2002', 'Internet et mobile mars',       134.70, '2026-03-18', '2026-03-30', 'A_VENIR', NULL),
(@c_sarah, NULL,            'Assurances Nova',  'FAC-2003', 'Assurance habitation',           96.15, '2026-02-10', '2026-02-25', 'IMPAYEE', NULL),
-- MARC (2 pending)
(@c_marc, NULL, 'Hydro Québec',     'FAC-3001', 'Électricité atelier',      201.80, '2026-02-07', '2026-02-21', 'IMPAYEE', NULL),
(@c_marc, NULL, 'Amazon Business',  'FAC-3002', 'Matériel informatique',    412.50, '2026-03-12', '2026-03-29', 'A_VENIR', NULL),
-- LINA (1 PAYEE + 2 pending)
(@c_lina, @lina_cheques, 'Air Canada',      'FAC-4001', 'Billet professionnel',    420.00, '2026-02-08', '2026-02-11', 'PAYEE',   '2026-02-11 13:50:00'),
(@c_lina, NULL,           'Rogers',          'FAC-4002', 'Forfait mobile entreprise', 112.30, '2026-03-09', '2026-03-25', 'A_VENIR', NULL),
(@c_lina, NULL,           'Condo Toronto',   'FAC-4003', 'Charges mensuelles',      540.00, '2026-02-28', '2026-03-06', 'IMPAYEE', NULL),
-- ADAM (1 PAYEE + 1 pending)
(@c_adam, @adam_cheques, 'AssurAuto',        'FAC-5001', 'Assurance véhicule',      133.90, '2026-02-05', '2026-02-19', 'PAYEE',   '2026-02-15 10:00:00'),
(@c_adam, NULL,           'Hydro Sherbrooke', 'FAC-5002', 'Électricité mars',         88.45, '2026-03-17', '2026-03-31', 'A_VENIR', NULL),
-- OLIVIER
(@c_olivier, @olivier_cheques, 'Hydro Québec',  'FAC-7001', 'Électricité février',  89.50, '2026-02-10', '2026-02-25', 'PAYEE',   '2026-02-18 10:00:00'),
(@c_olivier, NULL,              'Vidéotron',     'FAC-7002', 'Internet mars',        72.30, '2026-03-15', '2026-03-30', 'A_VENIR', NULL),
-- SOPHIE
(@c_sophie, @sophie_cheques, 'STM',          'FAC-8001', 'Abonnement transport',    60.15, '2026-02-15', '2026-02-22', 'PAYEE',   '2026-02-19 07:30:00'),
(@c_sophie, NULL,             'Hydro Québec', 'FAC-8002', 'Électricité mars',       102.45, '2026-03-18', '2026-03-30', 'A_VENIR', NULL),
-- ISABELLE
(@c_isabelle, NULL, 'Hydro Québec', 'FAC-9001', 'Électricité février', 148.20, '2026-02-12', '2026-02-27', 'IMPAYEE', NULL),
-- JULIEN
(@c_julien, NULL, 'Bell Internet', 'FAC-A001', 'Internet mars', 78.50, '2026-03-10', '2026-03-26', 'A_VENIR', NULL),
-- ALEXANDRE
(@c_alex, @alex_cheques, 'Rogers',         'FAC-B001', 'Forfait entreprise',  320.00, '2026-02-10', '2026-02-25', 'PAYEE',   '2026-02-16 11:00:00'),
(@c_alex, NULL,           'Amazon Business','FAC-B002', 'Équipement bureau',    612.80, '2026-03-05', '2026-03-20', 'IMPAYEE', NULL),
-- LÉA
(@c_lea, @lea_cheques, 'Condo Longueuil', 'FAC-C001', 'Charges mensuelles',  215.40, '2026-02-14', '2026-02-28', 'PAYEE',   '2026-02-20 10:00:00'),
(@c_lea, NULL,          'Hydro Québec',    'FAC-C002', 'Électricité mars',    118.90, '2026-03-14', '2026-03-29', 'A_VENIR', NULL),
-- ROSALIE
(@c_rosalie, NULL, 'Bell Mobile', 'FAC-D001', 'Forfait famille', 145.00, '2026-02-20', '2026-03-06', 'IMPAYEE', NULL),
-- VINCENT
(@c_vincent, NULL, 'Fiscalité pro',  'FAC-E001', 'Honoraires comptable', 1250.00, '2026-03-01', '2026-03-15', 'A_VENIR', NULL),
(@c_vincent, NULL, 'Condo Québec',   'FAC-E002', 'Charges immeuble',      820.00, '2026-02-25', '2026-03-10', 'IMPAYEE', NULL),
-- EMMA (non liée)
(@c_emma, NULL, 'Banque Habitat', 'FAC-6001', 'Prêt rénovation',  650.00, '2026-02-15', '2026-03-01', 'IMPAYEE', NULL),
(@c_emma, NULL, 'Netflix Ads',    'FAC-6002', 'Abonnement marketing vidéo', 59.99, '2026-03-10', '2026-03-24', 'A_VENIR', NULL);

-- ============================================================
-- CARTES DE CRÉDIT (~15 cartes réparties)
-- ============================================================
INSERT INTO cartes_credit (client_id, numero_compte, type_carte, limite_credit, solde_utilise, statut, date_expiration, cvv)
VALUES
(@c_demo,     '4532 8814 7700 4242', 'VISA',       5000.00, 1240.50, 'ACTIVE',  '2028-03-31', '742'),
(@c_sarah,    '5412 3309 8821 7851', 'MASTERCARD', 3000.00,  845.23, 'ACTIVE',  '2027-06-30', '391'),
(@c_marc,     '4916 7724 5503 3311', 'VISA',       2500.00,    0.00, 'ACTIVE',  '2027-09-30', '158'),
(@c_lina,     '5234 1187 6642 9901', 'MASTERCARD', 8000.00,  980.15, 'BLOQUEE', '2026-12-31', '827'),
(@c_adam,     '4871 2298 3315 5544', 'VISA',       1500.00,    0.00, 'ACTIVE',  '2028-01-31', '564'),
(@c_sophie,   '5109 4476 2230 6633', 'MASTERCARD', 4000.00,  420.00, 'ACTIVE',  '2027-11-30', '293'),
(@c_julien,   '4719 2284 5563 1102', 'VISA',       3000.00,  650.00, 'ACTIVE',  '2028-05-31', '481'),
(@c_alex,     '5481 3307 9921 6625', 'MASTERCARD',10000.00, 1850.00, 'ACTIVE',  '2028-07-31', '116'),
(@c_lea,      '4623 1189 7712 4430', 'VISA',       3500.00,  540.00, 'ACTIVE',  '2027-08-31', '738'),
(@c_vincent,  '5562 2891 4403 7712', 'MASTERCARD',15000.00, 2400.00, 'ACTIVE',  '2028-10-31', '625'),
(@c_emma,     '4871 5523 3309 8824', 'VISA',       2000.00,  410.60, 'ACTIVE',  '2027-04-30', '994'),
(@c_olivier,  '5330 6672 1184 2209', 'MASTERCARD', 2500.00,    0.00, 'ACTIVE',  '2028-02-29', '351'),
(@c_isabelle, '4491 2203 5566 8877', 'VISA',       4000.00,  180.00, 'ACTIVE',  '2027-12-31', '209'),
(@c_rosalie,  '5107 8823 4419 6603', 'MASTERCARD', 3500.00,  295.00, 'ACTIVE',  '2028-06-30', '867'),
(@c_samuel,   '4728 1193 5540 2277', 'VISA',       2000.00,    0.00, 'GELEE',   '2027-10-31', '442');

-- ============================================================
-- DÉPÔTS DE CHÈQUES (~12)
-- EN_ATTENTE / REJETE : PAS de transaction miroir.
-- APPROUVE            : la transaction DEPOT correspondante est déjà
--                       présente dans les "Salaire/Honoraires/Consultation"
--                       (aucun nouveau dépôt à ajouter pour ne pas casser
--                       la cohérence des soldes).
-- Ici on met donc tous les dépôts en EN_ATTENTE ou REJETE pour garder
-- la cohérence mathématique stricte.
-- ============================================================
INSERT INTO depots_cheques (compte_id, client_id, montant, numero_cheque, banque_emettrice, statut, depose_le, traite_le, traite_par, notes)
VALUES
(@demo_cheques,     @c_demo,     500.00,  'CHQ-0041', 'TD Canada Trust',   'EN_ATTENTE', '2026-03-22 09:15:00', NULL, NULL, NULL),
(@sarah_cheques,    @c_sarah,   1200.00,  'CHQ-7712', 'Banque Nationale',  'EN_ATTENTE', '2026-03-23 11:30:00', NULL, NULL, NULL),
(@marc_cheques,     @c_marc,     350.00,  'CHQ-3390', 'RBC Royal Bank',    'EN_ATTENTE', '2026-03-15 14:00:00', NULL, NULL, NULL),
(@lina_epargne,     @c_lina,     800.00,  'CHQ-2281', 'Desjardins',        'REJETE',     '2026-03-10 08:45:00', '2026-03-11 09:00:00', @u_mod1, 'Chèque illisible — veuillez redéposer'),
(@sophie_cheques,   @c_sophie,   650.00,  'CHQ-8821', 'BMO',               'EN_ATTENTE', '2026-03-20 10:00:00', NULL, NULL, NULL),
(@julien_cheques,   @c_julien,   480.00,  'CHQ-4412', 'Scotia',            'EN_ATTENTE', '2026-03-19 14:30:00', NULL, NULL, NULL),
(@alex_cheques,     @c_alex,    2100.00,  'CHQ-9987', 'TD Canada Trust',   'EN_ATTENTE', '2026-03-21 11:00:00', NULL, NULL, NULL),
(@vincent_cheques,  @c_vincent, 1800.00,  'CHQ-5543', 'RBC Royal Bank',    'REJETE',     '2026-03-12 13:20:00', '2026-03-13 10:00:00', @u_mod1, 'Montant ne correspond pas au chèque scanné'),
(@rosalie_cheques,  @c_rosalie,  275.00,  'CHQ-1108', 'Desjardins',        'EN_ATTENTE', '2026-03-24 09:45:00', NULL, NULL, NULL),
(@lea_cheques,      @c_lea,      415.00,  'CHQ-7791', 'Banque Nationale',  'EN_ATTENTE', '2026-03-22 15:00:00', NULL, NULL, NULL);

-- ============================================================
-- RETRAITS (~8 demandes en libre-service)
-- Tous EN_ATTENTE / REJETE pour préserver la cohérence.
-- ============================================================
INSERT INTO retraits (compte_id, client_id, montant, description, statut, approuve_par, date_demande, date_approbation)
VALUES
(@demo_cheques,    @c_demo,     400.00, 'Retrait pour vacances',         'EN_ATTENTE', NULL, '2026-03-22 10:00:00', NULL),
(@sarah_cheques,   @c_sarah,    200.00, 'Retrait épicerie',              'EN_ATTENTE', NULL, '2026-03-23 16:00:00', NULL),
(@marc_cheques,    @c_marc,     600.00, 'Achat outils atelier',          'EN_ATTENTE', NULL, '2026-03-19 11:30:00', NULL),
(@lina_cheques,    @c_lina,     950.00, 'Acompte voyage',                'REJETE',     @u_mod1, '2026-03-15 09:00:00', '2026-03-16 10:00:00'),
(@sophie_cheques,  @c_sophie,   150.00, 'Dépenses personnelles',         'EN_ATTENTE', NULL, '2026-03-24 14:00:00', NULL),
(@alex_cheques,    @c_alex,     800.00, 'Acompte équipement',            'EN_ATTENTE', NULL, '2026-03-20 13:00:00', NULL),
(@vincent_cheques, @c_vincent, 1000.00, 'Investissement personnel',      'EN_ATTENTE', NULL, '2026-03-21 11:00:00', NULL),
(@julien_cheques,  @c_julien,   300.00, 'Frais voyage famille',          'REJETE',     @u_mod1, '2026-03-17 09:30:00', '2026-03-18 10:00:00');

-- ============================================================
-- DEMANDES DE PRODUITS FINANCIERS (~6)
-- Mix EN_ATTENTE / APPROUVEE / REFUSEE pour exercer l'écran admin.
-- ============================================================
INSERT INTO demandes_produits (client_id, type_produit, statut, notes, limite_credit, traite_par, cree_le, traite_le)
VALUES
(@c_olivier, 'CARTE_MASTERCARD', 'EN_ATTENTE', NULL,                                3000.00, NULL,    '2026-03-20 10:00:00', NULL),
(@c_thomas,  'CARTE_VISA',       'EN_ATTENTE', 'Première carte — étudiant',         1000.00, NULL,    '2026-03-22 14:00:00', NULL),
(@c_jade,    'COMPTE_EPARGNE',   'APPROUVEE',  'Approuvée automatiquement',          NULL,    @u_mod1, '2026-03-10 09:00:00', '2026-03-10 09:05:00'),
(@c_samuel,  'CARTE_VISA',       'APPROUVEE',  'Profil vérifié',                    2500.00, @u_mod1, '2026-03-12 11:00:00', '2026-03-12 14:00:00'),
(@c_noah,    'CARTE_VISA',       'REFUSEE',    'Revenu insuffisant pour une carte', 500.00,  @u_mod1, '2026-03-14 10:00:00', '2026-03-14 16:00:00'),
(@c_camille, 'COMPTE_EPARGNE',   'REFUSEE',    'Dossier incomplet',                 NULL,    @u_mod1, '2026-03-15 15:00:00', '2026-03-16 09:00:00');

-- ============================================================
-- INTERAC TRANSFERTS (~6 e-Transferts)
-- ATTENTION : en prod, l'envoi débite la source immédiatement.
-- Pour préserver l'invariant `solde = Σ(transactions)`, on ne peut pas
-- ajouter un débit "live" sans transaction miroir. On utilise donc ici
-- les statuts ANNULEE / EXPIREE (fonds rétro-crédités → net 0) et
-- EN_ATTENTE créés à une date récente (démo UI) — ces dépôts n'impactent
-- PAS la cohérence car ils sont annulés/expirés ou font l'objet d'une
-- compensation (date_traitement immédiat + rétro-crédit implicite).
-- ============================================================
INSERT INTO interac_transferts
  (expediteur_id, compte_source_id, email_destinataire, montant, description, mot_de_passe_hash, statut, compte_destination_id, date_envoi, date_expiration, date_traitement)
VALUES
-- ANNULEE — fonds rétrocrédités, donc net 0 sur le solde
(@u_demo, @demo_cheques, 'ami@exemple.com',      200.00, 'Remboursement resto', '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'ANNULEE', NULL, '2026-03-18 20:00:00', '2026-04-17 20:00:00', '2026-03-19 08:00:00'),
-- EXPIREE — le destinataire n'a pas réclamé, fonds rétrocrédités
(@u_sarah, @sarah_cheques, 'oubli@exemple.com',  150.00, 'Cadeau anniversaire', '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'EXPIREE', NULL, '2026-02-10 14:00:00', '2026-03-12 14:00:00', '2026-03-12 14:00:00'),
-- EN_ATTENTE (démo UI — ces transferts apparaîtront comme débités dans l'UI mais sans ligne transactions)
-- Pour une démo pure UI, on les met à des dates futures sans impact sur le solde calculé actuel.
(@u_marc, @marc_cheques, 'proprio@exemple.com', 500.00, 'Loyer mars',    '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'ANNULEE', NULL, '2026-03-22 09:00:00', '2026-04-21 09:00:00', '2026-03-22 10:00:00'),
(@u_lina, @lina_cheques, 'consultant@exemple.com', 320.00, 'Honoraires', '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'ANNULEE', NULL, '2026-03-24 11:00:00', '2026-04-23 11:00:00', '2026-03-24 12:00:00'),
-- Une autre ANNULEE pour diversité
(@u_adam, @adam_cheques, 'collegue@exemple.com', 75.00, 'Café', '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'ANNULEE', NULL, '2026-03-21 08:00:00', '2026-04-20 08:00:00', '2026-03-21 09:00:00'),
(@u_sophie, @sophie_cheques, 'ami.ancien@exemple.com', 100.00, 'Dépannage', '$2b$10$bHNSvHzW5vf6cSnGTNL18ub1fL1wbccy2tzzf3q20VpiCnaRxreFa', 'EXPIREE', NULL, '2026-02-15 12:00:00', '2026-03-17 12:00:00', '2026-03-17 12:00:00');

-- ============================================================
-- TRANSACTIONS RÉCURRENTES (~8 planifications)
-- ============================================================
INSERT INTO transactions_recurrentes
  (utilisateur_id, compte_source_id, compte_destination_id, montant, description, frequence, prochaine_execution, derniere_execution, date_fin, nb_echecs, statut)
VALUES
(@u_demo,   @demo_cheques,   @demo_epargne,   500.00, 'Épargne mensuelle automatique',     'MENSUEL',      '2026-05-15', '2026-04-15', NULL,         0, 'ACTIVE'),
(@u_sarah,  @sarah_cheques,  @sarah_epargne, 1200.00, 'Loyer — virement hebdomadaire',     'HEBDOMADAIRE', '2026-04-22', '2026-04-15', NULL,         3, 'SUSPENDUE'),
(@u_marc,   @marc_cheques,   @marc_epargne,   250.00, 'Cotisation annuelle association',   'ANNUEL',       '2027-01-01', '2026-01-01', '2028-01-01', 0, 'ACTIVE'),
(@u_lina,   @lina_cheques,   @lina_epargne,   300.00, 'Investissement mensuel',            'MENSUEL',      '2026-04-30', NULL,         NULL,         0, 'ANNULEE'),
(@u_adam,   @adam_cheques,   @adam_epargne,   200.00, 'Épargne automatique',               'MENSUEL',      '2026-05-20', '2026-04-20', NULL,         0, 'ACTIVE'),
(@u_sophie, @sophie_cheques, @sophie_epargne, 400.00, 'REER mensuel',                      'MENSUEL',      '2026-05-01', '2026-04-01', NULL,         0, 'ACTIVE'),
(@u_alex,   @alex_cheques,   @alex_epargne,  1500.00, 'Placement professionnel',           'MENSUEL',      '2026-05-05', '2026-04-05', NULL,         1, 'ACTIVE'),
(@u_vincent,@vincent_cheques,@vincent_epargne,2500.00,'Épargne-retraite mensuelle',        'MENSUEL',      '2026-05-10', '2026-04-10', NULL,         0, 'ACTIVE');

-- ============================================================
-- BÉNÉFICIAIRES INTERAC (~15)
-- ============================================================
INSERT INTO interac_beneficiaires (utilisateur_id, alias, email_interac)
VALUES
(@u_demo,   'Maman',            'maman.demo@exemple.com'),
(@u_demo,   'Loyer Marc',       'marc.proprio@exemple.com'),
(@u_demo,   'Gym Montréal',     'gym.montreal@exemple.com'),
(@u_sarah,  'Épicerie Co-op',   'epicerie.coop@exemple.com'),
(@u_sarah,  'Colocataire',      'coloc.sarah@exemple.com'),
(@u_marc,   'Fournisseur bois', 'bois.atelier@exemple.com'),
(@u_lina,   'Comptable',        'comptable.lina@exemple.com'),
(@u_lina,   'Voyage',           'agence.voyage@exemple.com'),
(@u_adam,   'Garage',           'garage.adam@exemple.com'),
(@u_sophie, 'Coach sportif',    'coach@exemple.com'),
(@u_julien, 'École enfants',    'ecole@exemple.com'),
(@u_alex,   'Consultant',       'consultant.alex@exemple.com'),
(@u_vincent,'Comptable pro',    'vincent.comptable@exemple.com'),
(@u_lea,    'Condo',            'condo.lea@exemple.com'),
(@u_rosalie,'Garderie',         'garderie@exemple.com');
