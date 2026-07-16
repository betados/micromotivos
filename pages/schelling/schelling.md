title: Segregación sin segregacionistas
description: Una sociedad tolerante puede segregarse sola. Simula el modelo de Schelling y comprueba cómo preferencias mínimas acaban separando la cuadrícula.
lang: es
css: schelling.css
js: schelling.js

# Segregación sin segregacionistas

¿Son los barrios segregados racialmente fruto de una decisión consciente? ¿De una planificación centralizada? 
¿Es el urbanismo el causante? O 
¿Puede ser que sean el resultado agregado de las decisiones de ciudadanos individuales?

Esto se preguntaba en 1969 Thomas C. Schelling. 

Imagina un vecino cualquiera. No es racista: le da igual el color de sus vecinos y no le importa ser minoría en su calle. 
Pero un día mira alrededor y se da cuenta de que es el único. Y eso, aunque le cueste admitirlo, 
le incomoda. Así que se muda. Nada más. Ese es todo el prejuicio que hace falta.

Con unas pocas reglas sencillas podemos simular este comportamiento. Dos grupos conviven en una cuadrícula. 
Cada individuo está *feliz* cuando al menos una determinada proporción de sus vecinos pertenece a su grupo. 
Los ciudadanos *infelices* se mudan a un cuadro vacío elegido de forma aleatoria. Incluso con discriminaciones 
muy ligeras la cuadrícula se segrega de forma vehemente.

{{schelling}}