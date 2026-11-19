# business-scenario-planner

Aplicación local para aprender a modelar escenarios de inversión comercial. Compara una situación inicial con escenarios conservador, intermedio y favorable. Los resultados son condicionales, no predicciones ni probabilidades.

## Modelo antes del código

El contrato de cálculo, las unidades y el ejemplo numérico se documentan en [docs/MODELO.md](docs/MODELO.md). Este documento se ha creado antes de implementar la aplicación.

- **Facturación**: importe vendido; no equivale al dinero disponible ni al beneficio.
- **Margen de contribución**: facturación menos costes variables de atender esas ventas, antes de la inversión comercial. No es beneficio neto.
- **Recuperación**: tiempo necesario para que el margen **adicional respecto a la situación inicial** compense la inversión adicional.

Ejemplo: pasar de 50 a 100 consultas/mes, con cierre del 20 %, facturación de 200 €/cliente y margen de 80 €/cliente, eleva los clientes esperados de 10 a 20 al mes. La facturación pasa de 2.000 a 4.000 €/mes y el margen de 800 a 1.600 €/mes. Con 3.000 € de inversión adicional y seis meses, el resultado adicional es `6 × (1.600 − 800) − 3.000 = 1.800 €`; la recuperación teórica es `3.000 / 800 = 3,75 meses` (primer cierre mensual recuperado: mes 4). ROI incremental del horizonte: `1.800 / 3.000 × 100 = 60 %`.

## Alcance de la primera versión

- Cuatro situaciones editables, con horizonte común y comparación respecto a la inicial.
- Inversión única inicial, visitas/mes, consultas/mes, cierre (%), facturación por cliente y margen por cliente.
- Embudo, facturación, margen acumulado, resultado tras inversión, diferencias frente a la inicial, ROI incremental y recuperación.
- Gráfico del resultado adicional acumulado, fórmulas visibles y mensajes de validación.
- Ejemplo de partida restaurable con deshacer persistente y guardado automático en el navegador. Trabajo local, sin servicios externos.

Quedan fuera recurrencia de clientes, crecimiento mensual, inversión recurrente, costes fijos, impuestos, descuentos financieros, estacionalidad, atribución causal y previsión de tesorería. La conversión visitas→consultas se calcula como diagnóstico: las consultas son un supuesto directo.

## Criterios de aceptación

1. Los cuatro escenarios muestran sus supuestos y se actualizan al editarlos.
2. Cada entrada y resultado identifica su unidad y periodo; introducir `20` en cierre significa 20 %.
3. El ejemplo anterior reproduce exactamente sus resultados antes del redondeo de presentación.
4. Consultas ≤ visitas; importes de inversión y facturación no negativos; cierre entre 0 y 100; margen ≤ facturación por cliente; horizonte entero entre 0 y 120 meses.
5. Ceros, margen negativo, valores vacíos/no finitos e inversiones menores o iguales a la inicial tienen comportamiento explícito. Ningún resultado muestra NaN o infinito.
6. La recuperación usa margen adicional y distingue recuperación dentro/fuera del horizonte, ausencia de inversión adicional y ausencia de mejora de margen.
7. No se atribuyen probabilidades a los nombres de escenarios ni se presenta una relación automática entre inversión y visitas.
8. Interfaz utilizable con teclado, en escritorio y móvil; errores vinculados a sus campos.
9. Pruebas automatizadas del modelo y comprobación de funcionamiento local. Sin publicación ni despliegue.

## Archivos del proyecto

| Ruta | Responsabilidad |
| --- | --- |
| `README.md` | Uso, alcance y criterios de aceptación |
| `STATUS.md` | Estado, comprobaciones y límites conocidos |
| `docs/MODELO.md` | Fórmulas, unidades, supuestos y ejemplo |
| `index.html` | Estructura de la aplicación |
| `src/model.js` | Validación y cálculo independiente de la interfaz |
| `src/presentation.js` | Lectura de decimales y presentación sin falsos ceros |
| `src/storage.js` | Borradores, migración de datos, sincronización y deshacer |
| `src/app.js` | Edición y presentación de escenarios |
| `src/styles.css` | Diseño adaptable y accesibilidad visual |
| `tests/model.test.js` | Ejemplo y casos límite del cálculo |
| `tests/presentation.test.js` | Entradas, precisión visible y recuperación cerca del límite |
| `tests/storage.test.js` | Persistencia, recuperación de errores y ediciones entre pestañas |
| `tests/server.test.js` | Servidor, rutas permitidas, métodos y MIME |
| `scripts/server.mjs` | Servidor exclusivo de desarrollo local |
| `package.json`, `.gitignore` | Comandos y exclusiones del proyecto |

## Ejecutar localmente

Requisito: **Node.js 22 o superior**, con npm. No hay dependencias que instalar, compilación ni claves que configurar.

Desde esta carpeta:

```sh
npm run dev
```

Abre [http://127.0.0.1:4174](http://127.0.0.1:4174). El servidor escucha exclusivamente en el equipo local. Detén el proceso con `Ctrl+C`. Si el puerto está ocupado:

```sh
PORT=4175 npm run dev
```

No abras `index.html` directamente con `file://`: los módulos JavaScript necesitan el servidor HTTP local. El proyecto es independiente y no utiliza archivos de otros proyectos.

## Usar el planificador

1. Lee el ejemplo y las unidades en [docs/MODELO.md](docs/MODELO.md).
2. Ajusta primero la situación inicial y el horizonte común.
3. Introduce los supuestos de los otros tres escenarios. Los nombres no impiden modelar resultados peores ni implican probabilidades.
4. Compara el resultado adicional y la recuperación. Consulta la tabla para distinguir resultados mensuales, acumulados y diferencias frente a la inicial.
5. Abre «Entiende el modelo» para revisar fórmulas y limitaciones. «Restaurar ejemplo» vuelve a los datos de partida. «Deshacer restauración» recupera los supuestos anteriores, incluso después de recargar, mientras el almacenamiento esté disponible. Se conserva una restauración; otra restauración posterior a nuevas ediciones sustituye ese respaldo. Deshacer recupera el borrador completo, incluidas entradas inválidas.

Los cambios se guardan en `localStorage` del navegador para ese origen (dirección y puerto). No se envían al servidor ni se sincronizan entre navegadores. Se recuperan los datos de la versión anterior. Los campos vacíos e incompletos permanecen inválidos después de recargar. Si el almacenamiento falla, se avisa y el borrador permanece en memoria; vuelve a editar para reintentar el guardado. Recargar antes de que se guarde perderá esos cambios pendientes.

Para los decimales se acepta **coma o punto, sin separadores de miles**: `1500,50` y `1500.50` representan el mismo valor. `1.500` significa 1,5, no mil quinientos. No introduzcas símbolos de moneda o porcentaje. Los resultados se presentan con formato español; un importe no nulo menor de medio céntimo se indica expresamente en lugar de mostrar un falso cero.

En móvil, el selector «Escenario que quieres editar» muestra todos sus campos sin desplazamiento horizontal. Las tarjetas de resultados siguen comparando los tres escenarios. La tabla detallada de resultados se desplaza horizontalmente y mantiene las etiquetas visibles. Los errores se reúnen en un resumen con enlaces que muestran el escenario correspondiente y llevan el foco al campo. Los controles se pueden recorrer con `Tab`.

Las pestañas del mismo origen sincronizan los cambios guardados. Cada edición combina el campo modificado con el borrador más reciente para preservar las ediciones intercaladas en campos distintos. En un mismo campo prevalece el último guardado; `localStorage` no garantiza transacciones para escrituras exactamente simultáneas. No es una herramienta colaborativa multiusuario. No se ordenan automáticamente los escenarios cuando cambian sus resultados.

## Comprobaciones

```sh
npm test
npm run check
```

`npm test` ejecuta 44 pruebas sin dependencias: 17 del modelo, 7 de presentación, 15 de persistencia y 5 del servidor. `npm run check` comprueba sintaxis. Ver [STATUS.md](STATUS.md) para los hallazgos de la auditoría, los cambios aplicados y la verificación manual en navegador.

No hay comandos ni configuración de publicación o despliegue.
