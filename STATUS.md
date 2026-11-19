# Estado del proyecto

Fecha: 2026-11-12.

Versión actual: **0.2.0**, auditoría de buenas prácticas y usabilidad aplicada. **44/44 pruebas correctas**. El proyecto sigue siendo exclusivamente local.

## Auditoría aplicada en la versión 0.2

Revisión paralela de modelo, arquitectura/persistencia y usabilidad, seguida de integración y comprobación en navegador. El modelo económico y el ejemplo mantienen sus fórmulas y resultados. No se detectaron fallos sustantivos en el contrato de cálculo ni exposición de archivos privados por el servidor local.

| Prioridad | Hallazgo | Cambio aplicado |
| --- | --- | --- |
| Alta | Restaurar reemplazaba inmediatamente todo el trabajo sin recuperación | Deshacer restauración con respaldo completo, conservado al recargar; repetir reset sin nuevas ediciones mantiene el respaldo |
| Alta | La edición móvil requería desplazar una tabla de 850 px y perdía las etiquetas | Selector de escenario y tabla de dos columnas; controles táctiles de 44 px e inputs de 16 px |
| Alta | Los errores podían quedar en columnas fuera de pantalla | Resumen de errores con enlaces que muestran el escenario y enfocan el campo |
| Media | Una pestaña antigua podía sobrescribir cambios ajenos de otros campos | Actualización por campo sobre el último borrador y sincronización con eventos de almacenamiento |
| Media | Guardado y borradores no tenían pruebas propias | Módulo `storage.js` con migración del formato anterior, respaldo, fallos de lectura/escritura y 15 pruebas |
| Media | El estado visual prometía guardado aunque este fallara | Estado coherente con la disponibilidad, avisos accesibles y conservación en memoria ante errores |
| Media | La entrada decimal dependía del navegador y podía perder texto incompleto | Parser explícito coma/punto; borradores como texto; instrucciones junto a la tabla |
| Media | Cantidades pequeñas podían parecer cero y recuperaciones posteriores parecer dentro del plazo al redondear | Presentación explícita de valores pequeños y «Más de T meses» cerca del límite; 7 pruebas |
| Media | Al invalidar un escenario cambiaba el patrón de las otras líneas | Patrón permanente por escenario y leyenda con el mismo tipo de trazo |
| Media | Los resultados quedaban alejados de la edición | Enlaces directos para ir a resultados, volver a supuestos y consultar el modelo |
| Baja | Cambiar de ancho regeneraba la tabla y podía perder posición o foco | Se actualiza solo el gráfico; el escenario del campo enfocado se conserva al pasar a móvil |

Archivos modificados: `index.html`, `src/app.js`, `src/styles.css`, `scripts/server.mjs`, `tests/server.test.js`, `package.json`, `README.md`, `STATUS.md` y `docs/MODELO.md`. Nuevos: `src/presentation.js`, `src/storage.js`, `tests/presentation.test.js` y `tests/storage.test.js`. Sin dependencias añadidas.

## Verificación de la auditoría

- Suite actual: **44/44** (17 modelo, 7 presentación, 15 persistencia, 5 servidor); sintaxis comprobada con `npm run check`.
- Compatibilidad con el guardado anterior: valores recuperados al abrir la versión nueva; migración cubierta también por pruebas.
- Cierre `20,5` y horizonte 12: resultado adicional intermedio **7.080 €**, ROI **236 %**.
- Restauración seguida de recarga y deshacer: recupera exactamente `20,5` y horizonte 12 con sus resultados.
- Dos pestañas: horizonte 12 en una y cierre 21 en otra; ambas conservan y muestran los dos cambios.
- Inversión `3000,50`: resultado adicional intermedio **1.799,50 €**, ROI presentado **59,97 %**.
- Borrador incompleto `-` guardado y recargado: sigue inválido; enlace del resumen muestra el escenario correcto y enfoca el campo.
- Móvil a 390 × 844: página sin desbordamiento horizontal; edición completa de un escenario visible; teclado pasa de visitas a consultas del mismo escenario.
- Anchura mínima de 320 px: sin desbordamiento de página, seis campos del escenario visibles; sin IDs duplicados ni referencias ARIA inexistentes en el documento.
- Cambio escritorio→móvil con foco en Intermedio: conserva el campo enfocado y el escenario visible.
- Invalidar Conservador: Intermedio conserva trazo continuo y Favorable conserva trazo punteado.
- Consola sin errores ni advertencias durante los recorridos comprobados.
- Evidencia visual: `artifacts/auditoria-mobile.jpg` (archivo local excluido de Git). Al terminar se han recuperado los valores que había antes de las pruebas.
- Los fallos de almacenamiento y reintentos están comprobados mediante almacenamiento simulado en pruebas automatizadas; no se alteraron permisos del navegador del usuario.

Límite de esta auditoría: no es una certificación de accesibilidad, una auditoría de seguridad exhaustiva ni una prueba en todos los navegadores. Los recorridos de navegador siguen siendo manuales asistidos. Las escrituras exactamente simultáneas entre pestañas no tienen garantía transaccional; para el mismo campo gana el último guardado.

## Completado antes de programar

- Carpeta verificada: vacía, sin proyecto previo ni repositorio Git.
- Alcance, criterios de aceptación y archivos previstos en `README.md`.
- Contrato matemático y ejemplo numérico en `docs/MODELO.md`.
- Decisiones: inversión única inicial, flujo mensual constante, horizonte común y recuperación basada en margen adicional frente a la inicial.

## Primera versión completada

- Aplicación HTML/CSS/JavaScript sin dependencias ni compilación.
- Cuatro situaciones editables: inicial, conservadora, intermedia y favorable; horizonte común de 0 a 120 meses.
- Inversión, visitas, consultas, cierre, facturación y margen por cliente con unidades visibles.
- Resultados absolutos mensuales y acumulados; comparación incremental, ROI y recuperación.
- Gráfico del resultado adicional desde el desembolso del mes 0.
- Fórmulas y supuestos explicados en la propia interfaz y en `docs/MODELO.md`.
- Validación por campo; suspensión de resultados afectados; mensajes para inversión adicional nula/negativa y ausencia de mejora de margen.
- Guardado automático local, recuperación al recargar, aviso cuando el almacenamiento falla y restauración del ejemplo.
- Diseño adaptable, navegación por teclado, etiquetas accesibles y alternativa tabular al gráfico.
- Servidor local en `127.0.0.1:4174`; puerto configurable mediante `PORT`. Se eligió 4174 porque 4173 estaba ocupado por otro proceso que no se modificó.

## Verificación de la versión inicial 0.1

Entorno: Node.js 26.8.1, npm 11.19.0 y navegador integrado local. Requisito declarado: Node.js ≥22; no se ejecutó la suite por separado en cada versión de Node ni en todos los navegadores.

- `npm test`: **22/22 pruebas correctas** (17 del modelo, 5 del servidor).
- `npm run check`: correcto.
- Petición HTTP a la aplicación: **200**.
- Ejemplo de seis meses verificado en pantalla: resultados adicionales −600 €, +1.800 € y +10.200 €; recuperación de 7,5 (fuera del horizonte), 3,75 y aproximadamente 1,36 meses.
- Cierre 101 %: mensaje de validación y comparación suspendida.
- Consultas de la inicial mayores que sus visitas: comparaciones suspendidas, resultados absolutos válidos conservados.
- Horizonte cero: desembolso adicional −3.000 €, ROI −100 % y recuperación fuera del horizonte.
- Margen intermedio −5 €/cliente: resultado adicional −8.400 €, ROI −280 % y sin recuperación.
- Inversión inicial de 3.000 € o 4.000 €: escenarios sin inversión adicional o con menor inversión; ROI y recuperación no aplican.
- Campo vacío guardado y recargado: sigue inválido, sin convertirse en cero.
- Horizonte de 12 meses guardado y recargado: resultado intermedio +6.600 € y ROI 220 %.
- Restauración del ejemplo comprobada; los datos de prueba se sustituyeron por los valores de partida.
- Interfaz revisada en escritorio y móvil (390 × 844): sin desbordamiento de página; tablas desplazables. Importes máximos probados también en móvil.
- Sin errores ni advertencias de consola durante las interacciones verificadas.
- Captura de la comparación en `artifacts/escenarios-desktop.jpg` (artefacto local excluido de Git).

La suite automatizada comprueba además valores no finitos, límites de dominios, cierre cero/100 %, consultas cero, fracciones sin redondeo intermedio, identidad entre diferencias, recuperación en meses enteros y ratios extremos sin NaN/Infinity. El servidor se verifica para GET/HEAD, MIME, métodos no admitidos y rutas privadas/traversal.

## Límites conocidos y siguientes extensiones posibles

- Es un modelo determinista de primeras ventas mensuales constantes. No se estima causalidad ni probabilidad de escenarios.
- El margen es de contribución. Resultado tras inversión y recuperación no representan beneficio neto ni tesorería.
- No se modelan inversión recurrente, costes fijos, impuestos, recurrencia, estacionalidad o descuento temporal.
- Precisión de doble flotante, sin redondeos intermedios. Importes extremadamente grandes pueden perder precisión de céntimos; no es un libro contable. Ratios no representables se marcan fuera del rango numérico.
- Persistencia solo por navegador/origen, sin exportación ni sincronización entre dispositivos. Las pestañas del mismo origen sí se sincronizan desde la versión 0.2.
- Las pruebas de navegador fueron manuales asistidas, no forman parte de `npm test`; no se ha realizado una auditoría completa con lector de pantalla.
- Próximas extensiones opcionales: inversión mensual, embudo derivado por tasas, exportación de supuestos y sensibilidad de una variable.

## Publicación

Repositorio público de código en GitHub: https://github.com/TommyHavana/business-scenario-planner (2026-11-19). No se ha desplegado la aplicación como web; sigue ejecutándose localmente. No se han configurado servicios externos para su funcionamiento.

El servidor usado para comprobar la interfaz se detiene al finalizar. Arranque reproducible: `npm run dev`.
