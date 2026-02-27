# GoToT

Jednoduchý doplněk pro Okoun.cz, který přidává možnost „Skoku v čase“ přímo do navigační lišty – a nově ti k tomu naservíruje i dobové zprávy!

## ✨ Co je nového (v1.7+)
* **Blesková databáze zpráv:** Skript už neskrapluje Hyenu živě, ale tahá data z vlastní předpřipravené JSON databáze na GitHubu. A pokud v daný den Ondřej Neff zrovna nic nevydal, skript inteligentně najde nejbližší dostupné zprávy.
* **Vizuální průběh skoku:** Během cestování časem ve stylovém overlayi nově v reálném čase vidíš, jaké datum a rok skript zrovna míjí.
* **Neprůstřelný skener:** Vylepšená ochrana proti zacyklení, která spolehlivě ignoruje dynamické URL hashe Okounu a bezpečně pozná, kdy narazil na samotný počátek klubu, nebo naopak na jeho nejnovější konec.
* **Horní i spodní lišta:** Políčko pro datum najdeš pohodlně na začátku i na konci stránky.

## 🚀 Jak nainstalovat

1. Nainstaluj si rozšíření **Tampermonkey** pro svůj prohlížeč (Chrome, Firefox, Edge, Safari).
2. Klikni na odkaz níže a potvrď instalaci:

👉 **[NAINSTALOVAT SKRIPT (gotot.user.js)](https://github.com/hanenashi/gotot/raw/main/gotot.user.js)**

## 🎮 Jak to funguje

1. V liště stránkování (nahoře nebo dole) se objeví nové políčko pro **Datum**.
2. Vyber datum, kam se chceš podívat (do minulosti nebo do budoucnosti).
3. Stiskni **Enter** nebo klikni na ikonku lupy 🔍.
4. Otevře se okno stroje času. Zatímco skript na pozadí prohledává stránky Okounu a ukazuje ti letopočty, které zrovna míjí, ty si můžeš přečíst, co se v tu dobu dělo ve světě podle Hyena.cz.
5. Jakmile je hledání u konce, klikni na tlačítko **Přejít na datum**. 
6. Pokud se rozhodneš cestu přerušit dřív, tlačítko "Zastavuji..." tě vysadí přesně v tom roce, kterým skript zrovna projížděl.
