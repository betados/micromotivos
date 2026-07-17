title: Helado al lado
description: Dos heladeros eligen sitio en la playa. ¿Será Lo mejor para los bañistas lo mejor para los heladeros? ¿Podrías tú ganar a tu rival?
lang: es
css: hotelling.css
css: hotelling-n.css
css: hotelling-2d.css
js: hotelling.js
js: hotelling-n.js
js: hotelling-2d.js

# Helado al lado

Imagina que a una playa llena de bañistas acuden dos heladeros. Ambos tienen libertad para elegir la ubicación que 
prefieran a lo largo de esta. Lo ideal para los bañistas sería que los heladeros se ubicasen en las posiciones 1/4 y 
3/4 de la playa respectivamente. De esta forma los bañistas tendrán que recorrer como mucho un cuarto de la distancia de la playa 
para poder comprar un helado.  

{{playa_1}}

Esta distribución, ideal teóricamente, tiene un peligro. Nada impide que un heladero listillo se acerque 
ligeramente al centro. De esta forma le robaría los clientes más proximos al centro a su competidor. 

{{playa_2}}

Al otro no se le 
había ocurrido, pero no es tonto, por lo que se acerca el centro en la misma medida mas un extra por si la vista le 
está fallando, no vaya a ser. El primero aprovecha que el segundo está despachando unos helados para ganar otro poquito 
de terreno y el ciclo vuelve a empezar hasta que finalmente se encuentran espalda con espalda en la mitad de la playa.

{{playa_3}}

Se han quedado igual, repartiendose los clientes al 50%, pero ha empeorado su servicio pues los bañistas de los 
extremos ahora han
de recorrer la mitad de la playa. De hecho puede que estén peor porque esa lontananza puede disuadir a alguno de los 
menos apetentes. Ninguno de los heladeros se va a mover pues sería regalarle terreno a su competidor. 
Mientras están espalda con espalda podrían aprovechar para acordar volver a las posiciones de 1/4 y 3/4 pero 
siempre tendrán que gastar energía en vigilar a su nuevo socio. ¿Merecerá la pena ese esfuerzo?

¿Crees que podrías ganar a tu competidor si tú fueses uno de los heladeros?

{{playa_interactiva}}

¿Qué pasaría si llegasen más vendedores a la playa? ¿Habrá equilibrio? ¿Será este equilibrio lo mejor para los bañistas?

{{playa_int_varios}}

Veamos que ocurre cuando damos el salto a las dos dimensiones. Esto es un modelo más realista de como funciona una 
ciudad y puede ayudar a explicar porqué a veces parece que comercios del mismo gremio se juntan en una misma ubicación 
de forma aparentemente irracional.

{{playa_cuadrada}}

*Este es el modelo de competencia espacial que Harold Hotelling formuló en 1929 en [«Stability in Competition»](https://www.jstor.org/stable/2224214).*
