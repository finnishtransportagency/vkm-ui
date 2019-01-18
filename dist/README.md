# Käyttöliittymä (UI) uudelle viitekehysmuuntimelle (vkm-api:lle).

Käyttöliittymässä käyttäjä voi antaa muunnettavia sijaintitietoja excel-taulukoissa. UI käyttää vkm-apia tietojen muuntamiseen, ja antaa tulokset excel-taulukkoina.

Käyttöliittymäkoodin pohjana käytetään koodia, joka on kehitetty vanhan vkm:n UI:ta varten.

## Kehitysympäristön pystytys

1. Asenna node.js (https://nodejs.org/) (versio 0.12.7 tai uudempi)

2. Kloonaa tämä vkm-ui-repo (git clone https://github.com/finnishtransportagency/vkm-ui.git)

3. Hae ja asenna projektin tarvitsemat riippuvuudet hakemistoon, johon projekti on kloonattu: npm install

## Ajaminen

Sovellus käynnistetään komennolla: npm start

Sovellus käyttää oletusarvoisesti porttia 3000. Porttia voi vaihtaa asettamalla arvo ympäristömuuttujaan `VKM_PORT`.

Sovellus ottaa oletusarvoisesti viitekehysmuuntimen rajapintaan yhteyttä osoitteeseen http://10.129.65.37:8997. Rajapinnan osoitetta voi vaihtaa ympäristömuuttujalla `VKM_API_URL`.

Esimerkki ympäristömuuttujien käytöstä:

VKM_PORT=3000 VKM_API_URL=http://10.129.65.37:8997 npm start