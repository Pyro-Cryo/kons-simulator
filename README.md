# Kons-Sim
*"Sektionen måste drivas mer som ett företag" - Anonym Ordförande*

Som nybliven managementkonsult på $konsultbolag är ditt första uppdrag att styra upp Fysiksektionen. Året är 2016 och sektionen har precis flyttat ut ur barackerna på Kemigården, men kassan är tom och det nya Konsulatet är inte inrett ännu. Nu är det upp till dig att tillgodose studenternas krav på mikrovågsugnar, studieplatser, och tisdagspubar - allt för att maximera Genomströmningen™.

## Gameplay
Grunden är en top-down-vy av Konsulatet, antingen som planlösning eller en lagom lik bakgrundsbild. Den börjar i princip tom, men man har budget att börja placera ut ett par bord, stolar och en mikro. Utanför dörren spawnar varje morgon, och i slutet av varje föreläsningsslot, en grupp studenter.

Studenterna har som mål att klara sina studier, och det gör de genom att skriva inluppar. För att göra det behöver de:
- Sittplatser
- Studiero
- Mat
- Gott humör (kamratskap osv)

Beroende på hur många inluppar som görs, och hur bra de blir, ger kansliet sektionen pengar i slutet på varje vecka. Pengarna kan användas till att köpa in saker som används av studenterna, eller gå till ordförandes Bahamasfond.

### Idéer på beteenden / typer av studenter
Alla studenter styrs av förprogrammerad beteendelogik, tänk ett flödesschema. Om brandlarmet går utrymmer de, om de är hungriga försöker de äta mat (finns ingen mat tillgänglig värmer de en matlåda eller köper en Billys), mår de bra pluggar de. Olika taggar påverkar deras beteende (en pub- eller gasquegäst pluggar inte utan sjunger och dricker istället, en funktionär har större sannolikhet att diska efter sig).
- GK. Permanent bitter men ser till att Kons fungerar: tömmer soporna, diskar efter nØllan, lagar trasiga mikrovågsugnar, osv. (Lämnar aldrig Kons?)
- Funktionär. Som en mini-GK, hjälper till att möblera om, tömma soporna ibland, men kommer ibland och ställer en massa bra-att-ha-saker (skräp) på borden eller i fönsterbrädena som någon annan måste slänga.
- nØllan. Har inte riktigt koll på läget eller sig själva. Kan råka bränna sin matlåda i mikron, drar i nödhantaget eller trycker på lampknappen när de ska ut, lämnar disk efter sig.
- fkmare. Lagar mat och står i baren under fester.
- ftmare. Pysslar om krukväxter.

För att få lite variation har de också olika personlighetsdrag och humörsmätare.
- Hunger (mätare) förklarar sig själv.
- Humör (mätare), allmäntillstånd.
- Studiero (mätare) påverkas av miljön omkring och påverkar kvaliteten/hastigheten på inlupparna. Vissa föremål har en positiv effekt (ljuddämpande plattor, bra sittplats, internetuppkoppling) och andra negativ (konversationer i närheten, funktionärer som städar/lagar mat/flyttar bord).
- Bitterhet (mätare) gör alla omkring dem på lite sämre humör. Bitterhet ökar av att se folk skräpa ner eller lämna disk men minskar när folk beter sig. GK har ingen övre gräns.
- Mognad eller ålder (drag) påverkar hur sannolikt det är att personen beter sig ordentligt, och kan öka med tiden. Ju äldre man är desto lättare har man dock att bli bitter.
- Nördighet, geekighet, och töntighet (drag) bildar en 3-vektor som definierar en persons personlighet. Ju mindre avstånd mellan två personligheter, desto bättre kommer de överens och desto snabbare blir personerna på bra humör av att umgås.
- ...

### Saker
- Stol
- Bord
- Bänk (rymmer fler, betydligt sämre studiero)
- Soffa (bättre komfort)
- Mikrovågsugn
- Matlåda (färsk/odiskad/möglig)
- Ölkyl, behöver fyllas (kostar pengar) men sakerna kan säljas med vinst
- Kassamaskin, låser upp tisdagspubar
- Soppåse, behöver tömmas
- Pantsäck, behöver tömmas, luktar illa om den inte töms. Spawnar under pub/gasque.
- Bardisk
- Spis
- Diskho
- Diskställ
- Diskmaskin, kräver stor mognad för att hantera.
- Stor kastrull, används tillsammans med spisen för att laga gasquemat
- Vanlig kyl, spawnar senap och mögliga matlådor
- Dragkyl, används för att lagra överbliven gasquemat
- Godishylla, en lightversion av ölkyl + kassamaskin som fungerar när det inte är fest
- Läskkyl, komplement till godishyllan
- Skafferi, kan användas tillsammans med spis + vanlig kyl för att skapa en lunch
- Toalett
  + Toapapper, behöver fyllas på. Tar det slut blir det inte bra...
- Mopp och skurhink, svabbar bort klibbet efter en fest
- Badkar, kan skapa ftmare.
- Krukväxt, ökar trevnaden i en liten radie.
- Gasquedekoration, ökar trevnaden under fest men minskar den i andra sammanhang.
- Bokhylla, bonus till inluppar
- Brädspelshylla, bonus till umgänge, framförallt under pubar, men stör annars
- Klädhängare + kläder
- Flyttlådor, representerar "Bra att ha"-saker som funktionärer drar in. Kan ha en inventerings-lista med random prylar som nämnder använder men inte behöver få en egen sprite.
- Kaffekokare, ökar studietakten men riskerar att svämma över när den används.
- Vattenkokare. Ger Te under dagtid och pastavatten till pubbar. Kan börja brinna om den kokar torrt.
- Bestick. Minskar spill på borden när folk äter. Försvinner långsamt, dubbla takten under gasque.
- ...

### Händelser
- Tisdagspub/gasque
  - Man får definiera en alternativ festmöblering för pub och gasque. Funktionärer flyttar om till den nya möbleringen.
  - Målet är att maximera folks nöje/umgänge (positivt för studieorken), eller sin egen försäljning (pengar till nya möbler)
  - Blir en massa mat över som behöver hanteras
  - Smutsar ner, behöver svabbning
  - Möbler som används riskerar att gå sönder.
- Ordförande fyller år
- Sektionsmöte
- Besök
  - Akademiska hus
  - Väktare (framförallt under pub/gasque)
  - Föhsarinspring
  - Tillståndsenheten
  - Random maskinare under en pub som man måste kasta ut
- Random företag donerar jättemycket av:
  - Mat med kort utgångsdatum
  - Kollegieblock
  - Energidryck
- Matförgiftning av gasquemat (salmonellagate)
- Brand när spis eller mikro används
- Städdagar. Sänker GKs bitterhet och ökar mognaden hos de som dyker upp. Lär ge buffs till det mesta så kanske måste nerfas på nått sätt?
- SaFT:
  - Ökar studieresultaten några procent.
  - Gasque med 99 % omogna gäster.
  - Besökare stjäl inventarier (skyltar).
- Strömavbrott, om för många micros och vattenkokare används samtidigt.
- Inbrott, stjäl billig öl från ölkylen och pantsäckar.
- Tenta-period: Behövs extra studieplatser och inga fester. Går åt extra mycket i godisskåpet.
  - Efter tenta-perioden blir folk äldre?
- Mottagningen?
  - Dyker upp extra många nollan och nya funktionärer som inte vet nånting.
  - Varje morgon står det lite nya random prylar i entrén
  - Varje dag försvinner det några random inventarier
  - Extra mycket betalt från kansliet den veckan?
- Ordförande från annan sektion dyker upp och vill:
  - Låna gasque-bänkar (50% chans att två bänkar aldrig kommer tillbaka)
  - Sova över i kons (10 % chans att nånting blir stulet, 10 % att alkoholtillståndet ryker)
  - Byta jobbare till nån fest (sänker studieresultaten)
  - (Det finns inga fördelar)

### Övrigt
- Transportmedel (köps in)
  Behövs för att kunna köpa mat till pub/gasque och göra sig av med panten.
  - Skrinda. Billig, låg lastkapacitet. 50% chans att gå sönder vid varje användning.
  - Sektionsbilen. Dyr att köpa in, stor kapacitet. Omogna funktionärer har risk att krocka varvid bilen spenderar några dagar på verkstad vilket kostar pengar.
  - Cykel-kärra. Mittemellan. Blir lätt stulen?
  - Forrden. Billig och stor kapacitet. Kan bara köras av omogna funktionärer?

### MVP
- GK och vanlig student
- Hunger och Studiero
- Bord, stol, mikrovågsugn
