# Cyberpunk RED Solo Terminal v2.0 (wersja testowa)

## Zakres v2.0

- Wersjonowany zapis w localStorage (migracja z v1), import i eksport JSON.
- Inicjatywa REF + k10, ponowny rzut przy remisie, wielorundowa kolejka.
- Limit ruchu RUCH × 2 m na turę i odliczanie LA 1/2.
- Walka bronią palną, osobne akcje ataku NPC w ich turach, przeładowanie.
- Obrażenia k6, przebicie i ablacja OB/SP, krytyk z dwóch szóstek oraz rana krytyczna.
- Test przeżywalności na początku tury przy 0 PW i narastający modyfikator.
- Osłony jako odrębne pule punktów wytrzymałości; ostrzał osłony nie rani ukrytego celu.
- Narracja przez Netlify Function; brak API jest bez wpływu na rzuty.

## Użytkowanie

1. Kliknij **Rozpocznij walkę**; sprawdź czyja tura jest wyświetlana.
2. W swojej turze wykonaj do LA ataków, przesuń się (osobny licznik ruchu) lub przeładuj.
3. Przycisk **Następna tura** przechodzi do następnego żyjącego uczestnika.
4. W turze NPC użyj **Atak wroga**. Ten przycisk jest ręcznym rozstrzygnięciem jego ataku, nie samodzielną sztuczną inteligencją przeciwnika.
5. Przycisk **Medyk.** służy do testu stabilizacji, nie przywraca automatycznie PW.
6. Aby dodać więcej wrogów, zrób to przed rozpoczęciem walki.

## Znane ograniczenia i rozbieżności

Ta wersja NIE jest kompletną implementacją zasad walki Easy Mode. Jest to działający prototyp silnika turowej walki z testami, ale przed rozgrywką bez nadzoru MG należy dopisać:

- inicjatywę i reakcje przy działaniach specjalnych, pełne uniki i przeciwstawne testy wręcz;
- pełne skutki wszystkich ran krytycznych, ich łatanie/lecznicze testy oraz poprawne warunki ich usuwania;
- pełną zgodność kategorii umiejętności z kartami postaci, ekwipunek i bronie z PDF;
- rozliczanie dystansu *per para postaci* i pozycje na mapie (obecny dystans jest wspólny, wpisywany ręcznie);
- przełączenie między osłoną a odkryciem na podstawie faktycznej linii widoczności; obecny przycisk pozwala ręcznie założyć istnienie osłony;
- prawdziwą taktykę wielu przeciwników i automatyczny wybór ich akcji;
- śledzenie niektórych efektów krwawienia/ruchu i pełne zasady modyfikatorów;
- autoryzację Netlify przed publicznym udostępnieniem: pojedyncze hasło współdzielone w przeglądarce nie jest kompletnym systemem kontroli dostępu;
- realne testy na iOS (PWA, cache, przełączanie aplikacji), a także test end-to-end API.

Nie przyjmuj obecnego przycisku **UNIK** za automatyczny unik pocisku; mechanika przeznaczona do ataków z bronią palną nie przyznaje tu magicznej obrony. Konfigurację obrażeń i stylu oparto na przesłanym **CRED-EasyMode.pdf** (strony 16–23). Wszystkie wartości postaci są przykładowe.

# RED // Solo Terminal

Offline-first, mobilny PWA dla indywidualnej gry inspirowanej *Cyberpunk RED: Easy Mode*.

## Szybkie uruchomienie

1. Utwórz konto Netlify i nową stronę z tego repozytorium (GitHub lub Netlify CLI). Strona statyczna znajduje się w `public`, funkcja w `netlify/functions`, konfiguracja w `netlify.toml`.
2. W **Site configuration → Environment variables** dodaj:
   - `OPENAI_API_KEY` — Twój klucz OpenAI API, **nigdy** nie umieszczaj go w kodzie frontendu.
   - `SOLO_ACCESS_SECRET` — długi losowy sekret dostępu, np. generowany lokalnie w menedżerze haseł (nie krótki PIN). Wpisz go w oknie ☰ aplikacji na telefonie; utrzymywany jest tylko w `sessionStorage`.
   - `OPENAI_MODEL` — opcjonalne, domyślnie `gpt-5.5` (wybierz model dostępny na Twoim koncie API).
3. Uruchom nowe wdrożenie po dodaniu zmiennych. W Netlify Function zmienne z `netlify.toml` nie są udostępniane w runtime.
4. Otwórz stronę HTTPS na telefonie. iOS Safari: Udostępnij → Dodaj do ekranu głównego → Otwórz ikonę. Android Chrome: menu → Zainstaluj aplikację / Dodaj do ekranu głównego.
5. Testy silnika: `npm test`. Rozwój lokalny: `npm install -g netlify-cli`, następnie `netlify dev`; Netlify CLI obsłuży `/api/narrate`.

## Architektura

- `public/engine.js` — deterministyczne zasady, RNG `crypto.getRandomValues`, wstrzykiwalne źródło losowości w testach.
- `public/app.js` — prezentacja, zapis do `localStorage`, eksport/import JSON, FIFO narracji.
- `public/index.html` i `style.css` — responsywny interfejs z HUD.
- `public/sw.js` — offline cache plików statycznych. Endpoint LLM nigdy nie jest cache'owany.
- `netlify/functions/narrate.mjs` — izolowana funkcja API, sekret w env, OpenAI Responses API, bez prawa do aktualizowania lokalnego stanu gry.
- `netlify/functions/prompt.mjs` — systemowy master prompt.

## Zasady i jawne granice prototypu

Implementacja obejmuje: 1k10 z dodatkowymi rzutami dla 10 i pechem na 1,  k6, DV dla pięciu rodzin broni, test trafienia (wynik **większy** od DV), SP obu lokacji, ablację po penetracji, mnożnik ×2 dla lokacji głowy po SP, krytyk z min. dwóch szóstek (+5 obrażeń omijających SP), tabelę obrażeń krytycznych 2k6, uproszczoną stabilizację, przeładowanie i podstawowe stany ran. Komputer używa kryptograficznego RNG, ale nie ma niezależnego autorytatywnego serwera gry: użytkownik z narzędziami developerskimi może zmieniać stan i wyniki.

**Niezbędne zastrzeżenia:**
- Easy Mode celowo pomija część reguł pełnego systemu, np. strzały celowane. Dostępny w menu wyboru lokacji strzał w głowę z karą -8 jest **opcją z pełnego RED**, nie oficjalną mechaniką Easy Mode. Do ścisłej gry Easy Mode trzymaj lokację `body` (trafienia w głowę pochodzące z innych zasad lub wydarzeń można nadal rozpatrzyć przez silnik).
- Rejestr obrażeń krytycznych zawiera nazwę z tabeli, ale **nie automatyzuje wszystkich trwałych modyfikatorów** konkretnych obrażeń (np. bazowej kary testów śmierci lub utraty możliwości używania kończyny). Wymagają manualnego rozstrzygnięcia według podręcznika. To nie jest pełny silnik całej walki w RED.
- Makro UNIK wyrzuca test obrony, ale nie jest zintegrowane z automatycznym rozliczeniem ataku przeciwnika; strzały dystansowe można unikać tylko przy REF >= 8. Domyślna postać ma REF 7, więc wynik UNIK nie zastępuje dystansowego DV.
- Makro MEDYK. zużywa zasób ekwipunku **bez automatycznego przywracania PŻ**: Easy Mode nie ustala ogólnego przywrócenia PŻ przez dowolny „medykament”. Osobno dostępny jest test stabilizacji i dzienny odpoczynek.
- Stabilizacja i odpoczynek są uproszczeniem: brak pełnej obsługi śmierci, wszystkich progów, deat​h saves, leczenia kontuzji i gospodarki akcjami. Dopiero rozbudowa o pełną obsługę tych zasad umożliwi bezobsługową mechanikę.
- `localStorage` utrzymuje stan po zwykłym odświeżeniu, ale iOS może usunąć dane witryn (szczególnie przy braku pamięci); regularnie wykonuj eksport JSON. Offline działa mechanika, narracja wraca po odzyskaniu Internetu.
- Netlify Free jest darmowy tylko w granicach limitów platformy; OpenAI API jest oddzielnie rozliczane. Publiczne wdrożenie nadal może być atakowane (brak trwałego rate limiter, brak kont użytkowników). Hasło w funkcji to podstawowa bariera, nie odpowiednik produkcyjnego IdP. Dla publicznej usługi wymagane byłoby właściwe uwierzytelnianie i limity.

## Oryginalne materiały

Oficjalny darmowy Easy Mode: https://talsorianstore.com/collections/digital-products-pdfs/products/cyberpunk-red-easy-mode
Polska edycja: https://blackmonk.pl/cyberpunk-red-pdf/9-cyberpunk-red-easy-mode.html

Projekt nie zawiera treści fabularnych ani pełnych tabel z publikacji poza krótkimi faktami koniecznymi do implementacji przykładowych akcji. Nie jest produktem oficjalnym R. Talsorian Games.


## Korekta po analizie polskiego PDF Easy Mode (wersja 1.1)
Źródło: CRED-EasyMode.pdf, s. 16–23.
- 10 i 1 na k10 powodują dokładnie jeden dodatkowy rzut.
- Oficjalna tabela PT w tej wersji Easy Mode obejmuje pistolety, strzelby oraz karabiny szturmowe.
- W tabeli strzelb przedział 101–200 m ma PT 35.
- Ciężkie zranienie zaczyna się od połowy PW (włącznie).
- Pełny dzień odpoczynku wymaga wcześniejszej skutecznej stabilizacji.
- Wyłączono w interfejsie strzał mierzony w głowę, ponieważ Easy Mode odsyła po szczegóły do głównego podręcznika.

### Ograniczenia po korekcie
To nadal PROTOTYP, nie pełna implementacja zasad. Brakuje formalnego harmonogramu inicjatywy, wykorzystania wszystkich LA w jednej turze, osłon, tabeli efektów ran krytycznych i testów przeżywalności. Medykament jest zasobem demonstracyjnym, a nie oficjalną natychmiastową regeneracją. Stan gracza i przeciwników ma dane demonstracyjne.

## Aktualizacja v2.1 — medycyna / rany krytyczne

Wdrożono tabelę 11 typów ran 2k6 ze stron 22–23 przekazanego podręcznika, ich numery, status opatrzenia, wymagane specjalizacje i PT. Dostępne akcje PATCH (łatanie, 1 minuta) oraz HEAL (leczenie, 4 godziny), z ograniczeniem chirurgii do Medyka i zakazem samodzielnego leczenia trwałego. Opatrzenie wygasa przy przejściu dnia, z wyjątkiem ran Ciało obce i Naderwany mięsień, które łatanie usuwa trwale. Dodano migrację identyfikatorów starszych ran, testy medyczne oraz blokadę akcji po urazie kręgosłupa.

### Istotne ograniczenia

- Interfejs leczenia jest tymczasowym formularzem dialogowym i działa jako test umiejętności aktualnego uczestnika walki. Samodzielne leczenie trwałe jest zgodnie z regułą blokowane. Pełne zarządzanie medykiem poza walką oraz automatyczne upływanie minut i godzin to zadania dalszego etapu.
- Nie ma systemu wskazania konkretnej uszkodzonej ręki ani zarządzania trzymanymi przedmiotami, zatem opisy utraty kończyny i ujemne modyfikatory działań dłoni nie są jeszcze egzekwowane we wszystkich akcjach.
- Dla Zapadniętego płuca, Złamanej nogi i Odciętej nogi działają modyfikatory Ruchu i progu przeżywalności; dla Złamanych żeber i Ciała obcego działa kara za długi ruch. Pozostałe skutki mają częściowe pokrycie, nie jest to jeszcze pełna implementacja Easy Mode.
- Sam proces upływu dnia jest ręcznie potwierdzany, nie ma automatycznego zegara kampanii.
- Po migracji zapis postaci v1/v2 jest dostępny przez poprzednie klucze localStorage. Zaleca się eksport JSON przed aktualizacją.


## v2.2 — UX iPhone
- Stały, kompaktowy HUD, najnowsze zdarzenie i dolne 4 akcje. Historia zajmuje przewijalny środkowy panel.
- Rzadziej używane opcje przeniesione do menu „Więcej”; dystans i wybór przeciwnika pozostają w przewijanym panelu pod dziennikiem.
- Meta viewport ogranicza pinch zoom w Safari/PWA, gdy platforma respektuje ustawienie; systemowe gesty dostępności iOS pozostają poza kontrolą strony. Alternatywa: ustawienie rozmiaru tekstu w Opcjach.
- Ten sam klucz localStorage i format stanu, bez usuwania zapisanych kampanii. Eksport JSON zalecany przed każdą aktualizacją.
- Po wdrożeniu nowej wersji zamknij i ponownie uruchom PWA; service worker ma zmieniony cache na red-solo-v22-ui2.
- Widoki „Walka” i „Dziennik” są rozdzielone. Dziennik ma stałą wysokość i własny pasek przewijania, więc kolejne wpisy nie przesuwają ani nie zasłaniają sterowania walką.
