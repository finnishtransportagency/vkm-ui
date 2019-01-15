<<<<<<< HEAD
# vkm-ui

Käyttöliittymä (UI) uudelle viitekehysmuuntimelle (vkm-api:lle).

Käyttöliittymässä käyttäjä voi antaa muunnettavia sijaintitietoja excel-taulukoissa. UI käyttää vkm-apia tietojen muuntamiseen, ja antaa tulokset excel-taulukkoina.

Käyttöliittymäkoodin pohjana käytetään koodia, joka on kehitetty vanhan vkm:n UI:ta varten.

Ensimmäinen versio uuden vkm-ui:n koodista tuodaan tähän repositoryyn, kun se on testattu paikallisesti.
=======
# KÃ¤yttÃ¶liittymÃ¤ viitekehysmuuntimeen

## YmpÃ¤ristÃ¶n pystytys

1. [Asenna node.js](https://nodejs.org/) (versio 0.12.7 tai uudempi)

1. Kloonaa vkm-repo

  ```
  git clone https://github.com/finnishtransportagency/vkm.git
  ```

1. Hae ja asenna projektin tarvitsemat riippuvuudet hakemistoon, johon projekti on kloonattu

  ```
  cd vkm
  npm install
  ```

## Ajaminen

Sovellus kÃ¤ynnistetÃ¤Ã¤n komennolla:

  ```
  npm start
  ```

Sovellus kÃ¤yttÃ¤Ã¤ oletusarvoisesti porttia 3000. KÃ¤ytettÃ¤vÃ¤Ã¤ porttia voi vaihtaa asettamalla arvo ympÃ¤ristÃ¶muuttujaan `VKM_PORT`.

Sovellus ottaa oletusarvoisesti viitekehysmuuntimen rajapintaan yhteyttÃ¤ osoitteeseen http://10.129.65.37:8997. Rajapinnan osoitetta voi vaihtaa ympÃ¤ristÃ¶muuttujalla `VKM_API_URL`.

Esimerkki ympÃ¤ristÃ¶muuttujien kÃ¤ytÃ¶stÃ¤:

  ```
  VKM_PORT=3000 VKM_API_URL=http://10.129.65.37:8997 npm start
  ```

>>>>>>> sitowise
