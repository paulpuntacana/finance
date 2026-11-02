// Inhoud van de pagina "Structuur en plan van aanpak".
// Bron: onderzoek d.d. 2 november 2026 (zie sources). Cijfers zijn indicatief — laten toetsen
// door een Zwitserse Treuhänder (Wallis) en een Nederlandse emigratie-adviseur.

const DATA = {
  updated: '2 november 2026',
  intro: 'Welke bedrijfsvorm past bij Den Hartogh Solutions en SalesLobe als je (deels) in Wallis woont, een DR-residency hebt en Stripe nodig hebt? Alle opties naast elkaar, met belasting, bank, kosten en een stappenplan.',

  verdict: 'Woon je het grootste deel van het jaar in Wallis, dan word je in Zwitserland belast over je hele inkomen, ook als je bedrijf in de VS, Estland of Dubai staat. Een buitenlands bedrijf levert dan vooral extra kosten en risico op. De beste route: begin met een Zwitserse eenmanszaak en verkoop SalesLobe via Paddle of Stripe. Richt een SalesLobe GmbH op zodra het product echt tractie heeft. Een registratie in de DR lost het Stripe-probleem niet op.',

  phases: [
    { when: 'nu, vóór vertrek', title: 'Nederland netjes afsluiten', text: 'Laat je Nederlandse situatie doorrekenen (eenmanszaak: afrekening bij vertrek; BV: conserverende aanslag). Kies een duidelijke vertrekdatum en registreer niets in de DR.' },
    { when: 'aankomst in Wallis', title: 'Eenmanszaak + Stripe CH', text: 'B-vergunning als zelfstandige, eenmanszaak "Den Hartogh Solutions", AHV-inschrijving, zorgverzekering binnen 3 maanden. Stripe CH voor je diensten, Paddle of Stripe Managed Payments voor SalesLobe-abonnementen.' },
    { when: 'SalesLobe heeft tractie', title: 'SalesLobe GmbH', text: 'Richt vroeg een GmbH op (CHF 20.000 kapitaal), zodat de waardestijging in het bedrijf zit en een latere verkoop in principe belastingvrij is. Vanaf ca. CHF 120–150k winst ook het freelancewerk erin.' },
  ],

  keyPoints: [
    { q: 'Waar betaal ik belasting?', a: 'Waar je woont. Woon je hoofdzakelijk in Wallis, dan betaal je in Zwitserland belasting over je wereldinkomen. Een bedrijf dat je vanuit Zwitserland leidt, wordt daar ook belast (plaats van werkelijke leiding), waar het ook is opgericht.' },
    { q: 'Telt mijn DR-residency mee?', a: 'Pas als je er meer dan 182 dagen per jaar woont. Een verblijfsvergunning alleen maakt je geen belastingplichtige daar. Stripe ondersteunt bedrijven in de DR niet, dus voor SalesLobe helpt het niet.' },
    { q: 'Hoe los ik Stripe op?', a: 'Met een Zwitsers bedrijf, ook een eenmanszaak: Zwitserland is een volledig ondersteund Stripe-land. Of verkoop via een Merchant of Record (Paddle), die werkt vanuit bijna elk land en regelt btw wereldwijd voor je.' },
    { q: 'Wanneer btw (MWST) in Zwitserland?', a: 'Vanaf CHF 100.000 omzet per jaar, wereldwijd gerekend. Diensten aan buitenlandse bedrijven zijn 0% (verlegd). Verkoop je SaaS aan EU-consumenten zonder Merchant of Record, dan moet je vanaf de eerste euro in de EU-OSS.' },
    { q: 'Eenmanszaak of GmbH?', a: 'Bij ca. CHF 80k winst houd je met een eenmanszaak ongeveer CHF 2.500–3.500 meer over. Bij CHF 200k levert de GmbH ongeveer CHF 5.000+ per jaar op, en veel meer als je winst in het bedrijf laat of SalesLobe ooit verkoopt.' },
    { q: 'En mijn Nederlandse bedrijf?', a: 'Een eenmanszaak schrijf je uit; als je in Wallis woont bestaat er feitelijk geen Nederlandse onderneming meer. Heb je een BV, vraag dan vóór vertrek advies: Nederland legt een aanslag op je aandelen die onbeperkt openstaat, en kan zekerheid vragen omdat Zwitserland niet in de EU ligt.' },
  ],

  table: {
    columns: ['Optie', 'Winstbelasting', 'Effect als je in Wallis woont', 'Stripe', 'Opzetten', 'Per jaar', 'Oordeel'],
    rows: [
      ['Zwitserse eenmanszaak', 'n.v.t. (inkomstenbelasting)', 'Inkomstenbelasting + ca. 10% AHV over de winst', 'Ja', 'CHF 0–500', 'CHF 1–3k', { label: 'Beste start', tone: 'good' }],
      ['Zwitserse GmbH / Sàrl', 'ca. 11,9% tot CHF 250k', 'Salaris + dividend (60–70% belast); winst in bedrijf ca. 12%', 'Ja', 'CHF 0,8–3,5k + 20k kapitaal', 'CHF 2,5–6k', { label: 'Bij groei', tone: 'good' }],
      ['Merchant of Record (Paddle)', 'n.v.t. (aanvulling)', 'Opbrengst belast in je Zwitserse bedrijf', 'Niet nodig', 'CHF 0', '5% + $0,50 per transactie', { label: 'Voor SaaS-start', tone: 'good' }],
      ['US LLC (Stripe Atlas)', 'VS 0%', 'Zwitserland belast toch; extra VS-formulieren ($25k boete bij vergeten)', 'Ja (VS)', '$100–500', '$300–1.500 + CH-boekhouding', { label: 'Afraden', tone: 'bad' }],
      ['Estse OÜ (e-Residency)', '0% ingehouden, 22% bij uitkering', 'Leiding vanuit CH → Zwitserse winstbelasting; dubbele administratie', 'Ja', 'ca. €415', '€1–3k + CH', { label: 'Afraden', tone: 'bad' }],
      ['Nederlands bedrijf aanhouden', 'Vpb 19% / 25,8%', 'Leiding verschuift naar CH; aanslag op aandelen; dubbele claims', 'Ja', '—', '€2–5k + CH', { label: 'Afbouwen', tone: 'ok' }],
      ['UK / Ierland / Cyprus / Dubai', '0–25%', 'Voordeel valt weg zolang je in CH woont', 'Ja', '€0,5–5k', '€1–10k', { label: 'Alleen bij verhuizing', tone: 'ok' }],
      ['Registratie in de DR', 'territoriaal', 'Alleen relevant bij meer dan 182 dagen per jaar in de DR', 'Nee', '—', '—', { label: 'Niet voor dit doel', tone: 'bad' }],
    ],
  },

  calc: {
    sub: 'Gemeente Sion, belastingjaar 2026, alleenstaand. Berekend met de officiële rekenmachine van de Zwitserse belastingdienst (ESTV), zonder pensioenkas en Säule 3a. Bedragen in CHF.',
    columns: ['Winst per jaar', 'Eenmanszaak netto', 'GmbH netto', 'Verschil'],
    rows: [
      { cells: ['CHF 80.000', '61.800', '58.300 – 59.200', '+2.600 tot +3.500 eenmanszaak'] },
      { cells: ['CHF 200.000', '129.100', '134.400', '+5.300 GmbH'] },
      { cells: ['CHF 200.000, winst deels in GmbH', '129.100', '89.600 privé + 59.900 in bedrijf', 'belastingdruk nu ca. 27% i.p.v. 35%'], total: true },
    ],
    note: 'Met maximale Säule 3a (2026: tot CHF 36.288 voor zelfstandigen zonder pensioenkas) daalt de belasting van de eenmanszaak flink, maar dat geld staat vast tot je pensioen. Omslagpunt naar een GmbH: grofweg CHF 120–150k winst per jaar, of eerder bij een exit-plan.',
  },

  options: [
    {
      id: 'ch-einzelfirma', name: 'Zwitserse eenmanszaak', recommended: true, verdict: 'Beste start', verdictTone: 'good',
      summary: 'Je werkt als zelfstandige onder je eigen naam in Wallis. Simpel, goedkoop, Stripe werkt, en tot ca. CHF 120k winst fiscaal het gunstigst.',
      facts: [
        ['Belasting', 'Winst valt in je inkomstenbelasting (federaal + kanton + gemeente)'],
        ['Sociale lasten', 'AHV/IV/EO maximaal 10,0% (2026), lager onder CHF 60.500 inkomen'],
        ['Pensioen', 'Säule 3a: 20% van netto-inkomen aftrekbaar, max. CHF 36.288'],
        ['Inschrijving', 'Handelsregister verplicht vanaf CHF 100k omzet, daaronder vrijwillig'],
        ['Bank', 'PostFinance, Raiffeisen, BCVs, UBS + Revolut Business of Wise'],
        ['Kosten', 'Opzetten CHF 0–500, boekhouder CHF 1–3k per jaar'],
      ],
      pros: ['Weinig administratie', 'Stripe CH accepteert eenmanszaken', 'Fiscaal voordelig bij lagere winst', 'Grote aftrek via Säule 3a'],
      cons: ['Je bent persoonlijk aansprakelijk (let op bij SaaS met SLA\'s/AVG)', 'Boven ca. CHF 90k inkomen is AHV in feite extra belasting', 'Moeilijk te verkopen; verkoopwinst is belast'],
    },
    {
      id: 'ch-gmbh', name: 'Zwitserse GmbH / Sàrl', verdict: 'Bij groei', verdictTone: 'good',
      summary: 'Een eigen bv-achtige vennootschap in Wallis. Meer werk, maar beperkte aansprakelijkheid, lage belasting op winst die je in het bedrijf laat en een in principe belastingvrije verkoop van je aandelen.',
      facts: [
        ['Winstbelasting', 'ca. 11,9% tot CHF 250k, ca. 17% daarboven (per gemeente checken)'],
        ['Dividend', 'Federaal 70%, Wallis ca. 60% belast; 35% bronbelasting volledig terug te vragen'],
        ['Salaris', 'Werkgever + werknemer samen ca. 12,8% sociale lasten; salaris moet marktconform zijn'],
        ['Kapitaal', 'CHF 20.000, mag je daarna in het bedrijf gebruiken'],
        ['Accountantscontrole', 'Niet nodig bij minder dan 10 fte (opting-out vastleggen bij oprichting)'],
        ['Kosten', 'Oprichten CHF 800–3.500, boekhouder CHF 2,5–6k per jaar'],
      ],
      pros: ['Beperkte aansprakelijkheid', 'Winst in het bedrijf ca. 12% belast', 'Verkoop van aandelen in principe belastingvrij', 'Sterke uitstraling ("SalesLobe GmbH, Sion")'],
      cons: ['Salarisadministratie, pensioenkas, jaarrekening', 'Geld uit het bedrijf halen moet via salaris of dividend', 'Bij een latere verkoop opletten voor speciale regels (indirecte partiële liquidatie)'],
    },
    {
      id: 'mor', name: 'Merchant of Record voor SalesLobe', verdict: 'Voor SaaS-start', verdictTone: 'good',
      summary: 'Paddle (of Stripe Managed Payments) verkoopt jouw SaaS formeel aan de klant, regelt btw en Amerikaanse sales tax wereldwijd en betaalt jou uit. Jij factureert één partij.',
      facts: [
        ['Paddle', '5% + $0,50 per transactie, geen maandkosten'],
        ['Stripe Managed Payments', 'Stripe-tarief + ca. 3,5% (onbevestigd); bedrijf moet o.a. in CH/NL/EE/VS staan'],
        ['Polar', 'ca. 4–5% + $0,40–0,50 (tarieven 2026 onzeker)'],
        ['Btw voor jou', 'Je levert aan de MoR: buitenlandse B2B-dienst, 0% Zwitserse MWST'],
        ['Overstappen', 'Vanaf ca. $30–50k MRR loont direct Stripe + Stripe Tax'],
      ],
      pros: ['Geen EU-OSS- of Amerikaanse sales-tax-registraties nodig', 'Werkt met bijna elke entiteit', 'Chargebacks en facturen geregeld'],
      cons: ['Duurder dan direct Stripe (ca. 1,5–2,5% van de omzet)', 'Stripe Managed Payments alleen voor digitale producten, niet voor je dienstverlening', 'Je hebt nog steeds een bedrijf nodig waar de opbrengst belast wordt'],
    },
    {
      id: 'us-llc', name: 'US LLC (Stripe Atlas)', verdict: 'Afraden', verdictTone: 'bad',
      summary: 'Fiscaal "onzichtbaar" in de VS, maar Zwitserland ziet de LLC meestal als vennootschap die je vanuit Zwitserland leidt, en belast haar dan gewoon. Je houdt alleen de extra Amerikaanse verplichtingen over.',
      facts: [
        ['VS', 'Geen federale belasting zonder VS-activiteit, wel elk jaar Form 5472 + 1120'],
        ['Boete', '$25.000 per jaar bij een vergeten formulier'],
        ['Zwitserland', 'Meestal gezien als vennootschap → Zwitserse winstbelasting; ruling nodig voor zekerheid'],
        ['Kosten', 'Atlas $500 eenmalig + $100 per jaar; Delaware $300 per jaar'],
        ['Bank', 'Mercury/Relay; of ze oprichters in CH accepteren is onzeker'],
      ],
      pros: ['Snel op te zetten', 'Goed voor Amerikaanse klanten'],
      cons: ['Geen belastingvoordeel als je in CH woont', 'Dubbele administratie (VS + CH)', 'Hoge boetes bij vergissingen'],
    },
    {
      id: 'ee-ou', name: 'Estse OÜ (e-Residency)', verdict: 'Afraden', verdictTone: 'bad',
      summary: 'Aantrekkelijk op papier (0% op ingehouden winst), maar geleid vanuit Wallis wordt de OÜ in Zwitserland belastingplichtig. Het voordeel verdwijnt en je hebt twee administraties.',
      facts: [
        ['Estland', '0% op ingehouden winst, 22% bij uitkering (verhoging naar 24% is geschrapt)'],
        ['Zwitserland', 'Plaats van leiding in CH → jaarlijks ca. 12–17% winstbelasting'],
        ['Kosten', 'e-Residency €150 (2027: €165), registratie €265, €1–3k per jaar'],
      ],
      pros: ['Volledig online', 'Stripe werkt'],
      cons: ['Voordeel valt weg zolang je in CH woont', 'Risico op belasting in twee landen'],
    },
    {
      id: 'nl', name: 'Nederlandse structuur aanhouden', verdict: 'Afbouwen', verdictTone: 'ok',
      summary: 'Werkt alleen als je minder dan de helft van het jaar in Zwitserland woont en je leven in Nederland blijft. Anders: eenmanszaak uitschrijven, BV laten doorrekenen vóór vertrek.',
      facts: [
        ['Eenmanszaak', 'Uitschrijven; mogelijk afrekening over stille reserves/goodwill'],
        ['BV', 'Conserverende aanslag op je aandelen, blijft onbeperkt openstaan; zekerheid kan worden gevraagd'],
        ['Tarieven 2026', 'Vpb 19% / 25,8%, box 2 24,5% / 31%'],
        ['Erfbelasting', 'Nog 10 jaar als Nederlands inwoner beschouwd'],
      ],
      pros: ['Bestaande klanten en bank blijven werken'],
      cons: ['Leiding vanuit CH verschuift de belastingplicht', 'Dubbele administratie en claims'],
    },
    {
      id: 'other', name: 'UK, Ierland, Cyprus, Dubai', verdict: 'Alleen bij verhuizing', verdictTone: 'ok',
      summary: 'Lage tarieven werken alleen als je daar ook echt woont. Geleid vanuit Wallis is elk van deze bedrijven ook in Zwitserland belastingplichtig.',
      facts: [
        ['UK Ltd', '19–25%, geen voordeel vanuit CH'],
        ['Ierland', '12,5%, zelfde probleem'],
        ['Cyprus non-dom', 'Alleen als je in Cyprus woont (60- of 183-dagenregel)'],
        ['Dubai (vrije zone)', '0% / 9%, maar geleid vanuit CH ook Zwitsers belastingplichtig'],
      ],
      pros: ['Interessant als je later echt verhuist'],
      cons: ['Geen voordeel zolang Wallis je woonplaats is'],
    },
  ],

  payments: [
    { name: 'Stripe (Zwitserland)', tag: 'Diensten + SaaS', tone: 'good', text: 'Werkt met een Zwitserse eenmanszaak of GmbH. Voor facturen aan klanten en, met Stripe Billing + Stripe Tax, ook voor abonnementen.', cost: 'ca. 2,9–3,5% per betaling + 0,5% Stripe Tax' },
    { name: 'Paddle', tag: 'Aanbevolen voor SalesLobe', tone: 'good', text: 'Merchant of Record: verkoopt SalesLobe namens jou, regelt btw/sales tax wereldwijd, betaalt uit naar je Zwitserse rekening.', cost: '5% + $0,50 per transactie' },
    { name: 'Stripe Managed Payments', tag: 'Alternatief', tone: 'ok', text: 'Stripes eigen Merchant of Record. Zwitserse bedrijven toegestaan, alleen voor digitale producten (niet je dienstverlening).', cost: 'Stripe-tarief + ca. 3,5% (onbevestigd)' },
  ],

  checklist: [
    { title: 'Nederland afsluiten', items: [
      'Uitschrijven bij de gemeente, uiterlijk 5 dagen vóór vertrek',
      'Eenmanszaak: KVK uitschrijven, btw-nummer stoppen, laatste btw-aangifte',
      'M-biljet (aangifte emigratiejaar) indienen',
      'BV (indien aanwezig): advies over conserverende aanslag, waardering, eventueel liquidatie',
      'Nederlandse zorgverzekering stoppen per vertrekdatum',
      'Overwegen: vrijwillige AOW-verzekering bij de SVB (aanvragen binnen 1 jaar)',
    ] },
    { title: 'Zwitserland / Wallis', items: [
      'Aanmelden bij de gemeente (Contrôle des habitants) binnen 8–14 dagen',
      'B-vergunning EU/EFTA als zelfstandige aanvragen (businessplan, contracten, huurcontract)',
      'Zorgverzekering (KVG) binnen 3 maanden afsluiten',
      'Ongevallenverzekering regelen',
      'AHV: aanmelden als zelfstandige bij de Caisse de compensation du Valais',
      'Optioneel: inschrijving Handelsregister + UID-nummer',
      'Zakelijke rekening (BCVs, PostFinance, Raiffeisen of UBS) + Revolut Business of Wise',
      'Säule 3a-rekening openen',
      'Treuhänder kiezen en laten doorrekenen: eenmanszaak vs. GmbH met jouw cijfers',
    ] },
    { title: 'Betalingen en SalesLobe', items: [
      'Stripe-account op je Zwitserse bedrijf openen',
      'Paddle (of Stripe Managed Payments) aanvragen voor SalesLobe',
      'In DHS Finance een entiteit met jurisdictie Zwitserland en CHF als basisvaluta aanmaken',
      'MWST-drempel (CHF 100k wereldwijd) in de gaten houden',
    ] },
  ],

  risks: [
    { title: 'Dubbele woonplaats', text: 'Verdeel je je tijd over Zwitserland, de DR en Nederland, zorg dan dat de feiten (woning, verzekering, bank, dagen) duidelijk naar één land wijzen. Tussen Zwitserland en de DR is er waarschijnlijk geen belastingverdrag dat een conflict oplost.' },
    { title: 'Winstbelasting Wallis', text: 'Bronnen noemen 11,9%, 14,6% en 17,1%. Waarschijnlijk ca. 11,9% tot CHF 250k winst, maar check dit voor jouw gemeente met de rekenmachine van het kanton.' },
    { title: 'Schijnzelfstandigheid', text: 'Werk je veel voor één opdrachtgever, dan kan de AHV-kas je als werknemer zien. Zorg voor meerdere klanten en een erkenning als zelfstandige.' },
    { title: 'Nederlandse BV bij vertrek', text: 'De aanslag op je aandelen blijft onbeperkt openstaan en kan bij dividend of verkoop worden ingevorderd. Regel dit vóór je vertrekt.' },
    { title: 'Te laag salaris in een GmbH', text: 'Een te laag salaris met veel dividend kan door de AHV worden omgezet naar salaris. Laat de verdeling door je Treuhänder bepalen.' },
    { title: 'Sommige cijfers zijn onbevestigd', text: 'Onder meer het Wallis-tarief op dividend (60%), de FAK-bijdrage voor zelfstandigen, de saldosteuersatz voor jouw activiteit en de toeslag van Stripe Managed Payments.' },
  ],

  disclaimer: 'Dit is een onderzoek, geen persoonlijk belastingadvies. Laat de keuze en de cijfers toetsen door een Zwitserse Treuhänder (fiduciaire) in Wallis en een Nederlandse emigratie-adviseur voordat je iets registreert of uitschrijft.',

  sources: [
    { label: 'ESTV — btw-plicht bij buitenlandse omzet', url: 'https://www.estv.admin.ch/estv/en/home/value-added-tax/vat-tax-liability/foreign-companies.html' },
    { label: 'Stripe — ondersteunde landen', url: 'https://stripe.com/global' },
    { label: 'Stripe Managed Payments — voorwaarden', url: 'https://docs.stripe.com/payments/managed-payments/eligibility' },
    { label: 'Paddle — tarieven', url: 'https://www.paddle.com/pricing' },
    { label: 'PwC — vennootschappen in Zwitserland (plaats van leiding)', url: 'https://taxsummaries.pwc.com/switzerland/corporate/corporate-residence' },
    { label: 'Belastingdienst — conserverende aanslag bij emigratie', url: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/buitenland/content/conserverende-aanslag-bij-emigratie' },
    { label: 'KVK — belastingtarieven 2026', url: 'https://www.kvk.nl/geldzaken/belastingtarieven-2026/' },
    { label: 'Bucher Tax — US LLC in Zwitserland', url: 'https://en.bucher-tax.ch/blog/besteuerung-us-llc-schweiz' },
    { label: 'PwC — belastingen Dominicaanse Republiek', url: 'https://taxsummaries.pwc.com/dominican-republic/individual/taxes-on-personal-income' },
    { label: 'UBS — Säule 3a maximum 2026', url: 'https://www.ubs.com/ch/de/help/pension/maximal-contribution-2026.html' },
    { label: 'BAG — zorgverzekeringsplicht 2026', url: 'https://www.bag.admin.ch/dam/de/sd-web/bN8mlQd4BiyU/FAQ%20Versicherungspflicht_2026.pdf' },
    { label: 'e-Residency — wijzigingen 2025 en later', url: 'https://www.e-resident.gov.ee/en/blog/posts/changes-to-e-residency-in-2025-and-beyond' },
  ],
}

export default DATA
