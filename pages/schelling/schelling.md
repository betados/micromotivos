title: Segregación sin segregacionistas
description: Una sociedad tolerante puede segregarse sola. Simula el modelo de Schelling y comprueba cómo preferencias mínimas acaban separando la cuadrícula.
lang: es
css: schelling.css
js: schelling.js

# Segregación sin segregacionistas.

¿Son los barrios segregados racialmente fruto de una decisión consciente? ¿De una planificación centralizada? 
¿Es el urbanismo el causante? O 
¿Puede ser que sean el resultado agregado de las decisiones de ciudadanos individuales?

Esto se preguntaba en 1969 Thomas C. Schelling. 

Su hipótesis es que las socidades, como buenos sistemas complejos, pueden dar lugar a dinámicas emergentes complejas a 
raiz de microdecisiones casi inconscientes de sus individuos. 
Aunque la sociedad no sufra de un racismo total si puede ocurrir que a alguien no le guste ser el único de su raza 
en el barrio. Puede que no le importe incluso estar en minoría, pero siempre suele haber algún umbral que de 
cruzarse le haga estar incómodo. Es entonces cuando decide mudarse. Lo que empeora el problema para los de su raza 
que se queden y provoca una cascada que empuja al resto a mudarse también. El único equilibrio estable acaba siendo 
la segregación total a pesar de ser una sociedad tolerante.

Con unas pocas reglas sencillas podemos simular este comportamiento. Dos grupos conviven en una cuadrícula. 
Cada individuo está *feliz* cuando al menos una determinada proporción de sus vecinos pertenece a su grupo. 
Los ciudadanos *infelices* se mudan a un cuadro vacío elegido de forma aleatoriamente. Incluso con discriminaciones 
muy ligeras la cuadrícula se segrega de forma vehemente.

{{schelling}}