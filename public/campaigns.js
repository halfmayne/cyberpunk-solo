// Ready-to-play scenarios. Campaign progression is authored locally; AI narration is optional.
export const campaigns = [{
  id: 'kabuki-data',
  title: 'Dług w Kabuki',
  subtitle: 'Odzyskaj dane, zanim znikną z Night City.',
  location: 'Night City • Kabuki',
  playerName: 'Raven',
  stages: [
    {
      title: '1 / Wejście do magazynu',
      scene: 'Deszcz zalewa zaułek Kabuki. W środku magazynu gang przegląda skradziony pakiet danych. Jeden ze zbirów pilnuje bocznego wejścia.',
      objective: 'Pokonaj strażnika przy wejściu.',
      action: 'Kontynuuj misję',
      requiresClear: true,
    },
    {
      title: '2 / Pakiet danych',
      scene: 'Terminal mruga czerwonym światłem. Pakiet jest na miejscu, ale jego pobranie uruchamia alarm. Kroki rozlegają się po drugiej stronie drzwi.',
      objective: 'Pobierz pakiet. Alarm ściągnie dwóch przeciwników.',
      action: 'Pobierz pakiet',
    },
    {
      title: '3 / Droga na dach',
      scene: 'Dane są już w twoim chipie. Dwóch uzbrojonych gangerów blokuje wyjście na dach. Za nimi czeka droga ucieczki.',
      objective: 'Pokonaj przeciwników i oczyść drogę ucieczki.',
      action: 'Zakończ misję',
      requiresClear: true,
    },
    {
      title: 'Misja ukończona',
      scene: 'Pakiet danych jest bezpieczny, a ty znikasz w neonowym tłumie Kabuki. Ktoś właśnie zapisał twój numer.',
      objective: 'Udało się. Możesz wrócić do gry albo rozpocząć nową kampanię.',
      complete: true,
    },
  ],
}];

export const campaignById = id => campaigns.find(campaign => campaign.id === id) || campaigns[0];

