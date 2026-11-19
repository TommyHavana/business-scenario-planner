# Modelo de escenarios comerciales · v1

Contrato de cálculo documentado antes de programar. Todas las cantidades monetarias están expresadas en euros, sin IVA. No se presupone ningún sector o canal concreto.

## Entradas y unidades

| Símbolo | Entrada | Unidad y dominio |
| --- | --- | --- |
| I | Inversión única al comenzar, en el mes 0 | €; 0 a 1.000.000.000 |
| V | Visitas mensuales | visitas/mes; 0 a 1.000.000.000 |
| Q | Consultas mensuales originadas por esas visitas | consultas/mes; 0 ≤ Q ≤ V |
| p | Porcentaje de consultas que se convierten en clientes | %; 0 a 100; `20` significa 20 % |
| F | Facturación media de la primera venta por cliente | €/cliente; 0 a 1.000.000.000 |
| m | Margen de contribución medio por cliente | €/cliente; −1.000.000.000 ≤ m ≤ F |
| T | Horizonte común para todas las situaciones | meses enteros; 0 a 120 |

Se permiten cantidades fraccionarias en visitas y consultas porque pueden representar medias mensuales. Los límites superiores son límites operativos de esta calculadora, no límites económicos. Margen negativo representa una venta cuyos costes variables superan la facturación. Si se desea un margen de 80 € sobre una venta de 200 €, se introduce `80`, no `40` ni `0,40`.

La situación inicial tiene exactamente las mismas entradas que los otros escenarios. Su inversión debe representar desembolsos contemplados en el mismo mes 0, no costes históricos ya hundidos. Por defecto es 0 €.

## Hipótesis explícitas

- La inversión ocurre una sola vez al inicio. No es gasto mensual.
- Visitas, consultas, cierre, facturación por cliente y margen por cliente se mantienen constantes durante T meses.
- Una consulta puede producir como máximo un cliente en este embudo y cada cliente aporta una sola venta. No se modelan repetición, suscripciones o permanencia de cohortes.
- Los resultados usan clientes esperados fraccionarios. No se redondean clientes antes de calcular euros.
- La relación inversión→visitas y visitas→consultas se propone manualmente. La aplicación no estima causalidad ni elasticidades.
- El margen excluye la inversión comercial introducida para evitar descontarla dos veces. Se calcula después de costes variables de la venta y antes de costes fijos, impuestos y financiación.
- El margen se genera uniformemente desde el inicio para el cálculo teórico de recuperación. El modelo no representa cobros, pagos ni retrasos de conversión. Recuperar margen no equivale necesariamente a recuperar efectivo en caja.
- «Conservador», «intermedio» y «favorable» son nombres de conjuntos de supuestos editables, sin probabilidades asignadas ni orden garantizado tras editarlos.

## Fórmulas por situación

1. Conversión visita→consulta: `q = Q / V × 100` (%). Con V = Q = 0 es «No aplica», no 0 % ni una división infinita.
2. Clientes esperados al mes: `C = Q × (p / 100)` (clientes/mes).
3. Facturación mensual: `R = C × F` (€/mes).
4. Margen de contribución mensual: `M = C × m` (€/mes).
5. Clientes del horizonte: `C_T = C × T` (clientes).
6. Facturación del horizonte: `R_T = R × T` (€).
7. Margen del horizonte antes de inversión: `M_T = M × T` (€).
8. Resultado tras inversión del horizonte: `N_T = M_T − I` (€). Sigue sin ser beneficio neto: faltan otros gastos y tributos.

Facturación y margen son distintos: el margen es la parte de la facturación que queda después de los costes variables. No se puede deducir facturación conociendo solo el margen; por eso se añade F como entrada explícita.

## Comparación frente a la situación inicial

El subíndice 0 identifica la situación inicial; el subíndice s, cualquier escenario:

- Inversión adicional: `ΔI = I_s − I_0` (€).
- Margen mensual adicional: `ΔM = M_s − M_0` (€/mes).
- Facturación adicional del horizonte: `ΔR_T = (R_s − R_0) × T` (€).
- Margen adicional del horizonte: `ΔM_T = ΔM × T` (€).
- Resultado adicional tras inversión: `ΔN_T = ΔM × T − ΔI = N_T,s − N_T,0` (€).
- ROI incremental del horizonte: `ROI = ΔN_T / ΔI × 100` (%), definido aquí solo cuando ΔI > 0. No se anualiza.
- Curva de resultado adicional: `ΔN(t) = ΔM × t − ΔI`, para t entre 0 y T.

No debe usarse todo el margen del escenario para justificar una nueva inversión: parte ya existía en la situación inicial.

## Recuperación de la inversión adicional

Cuando ΔI > 0 y ΔM > 0, `P = ΔI / ΔM` meses es el cruce teórico de la curva con cero. La primera evaluación mensual recuperada es `ceil(P)`; si el cruce cae exactamente en un mes entero, se conserva ese mes (con tolerancia numérica).

| Condición | Interpretación |
| --- | --- |
| ΔI > 0, ΔM > 0 y P ≤ T | Recuperación teórica dentro del horizonte |
| ΔI > 0, ΔM > 0 y P > T | No se recupera dentro del horizonte; P es una extrapolación que exige mantener los supuestos más allá de T |
| ΔI > 0 y ΔM ≤ 0 | No se recupera con estos supuestos; ROI del periodo sigue definido |
| ΔI = 0 | Sin inversión adicional; recuperación y ROI incremental no aplican |
| ΔI < 0 | Menor inversión que la inicial; recuperación y ROI incremental no aplican. Se conserva el resultado adicional |

Con T = 0, clientes, facturación y margen acumulados son cero; el desembolso inicial sí ocurre: N₀ = −I y ΔN₀ = −ΔI. Si existe inversión adicional, ROI₀ = −100 %. Con cierre o consultas cero, los clientes son cero. Con margen cero no hay contribución de las ventas a recuperar inversión. Una entrada inválida suspende los resultados afectados, sin convertir una celda vacía en cero ni conservar un resultado anterior como si fuera vigente. Si la inicial es inválida, tampoco se calculan comparaciones.

## Ejemplo numérico reproducible

Horizonte: 6 meses. F = 200 €/cliente y m = 80 €/cliente en las cuatro situaciones.

| Magnitud | Inicial | Conservador | Intermedio | Favorable |
| --- | ---: | ---: | ---: | ---: |
| Inversión única (€) | 0 | 3.000 | 3.000 | 3.000 |
| Visitas/mes | 1.000 | 1.500 | 2.000 | 2.500 |
| Consultas/mes | 50 | 75 | 100 | 150 |
| Cierre (%) | 20 | 20 | 20 | 25 |
| Clientes/mes | 10 | 15 | 20 | 37,5 |
| Facturación/mes (€) | 2.000 | 3.000 | 4.000 | 7.500 |
| Margen/mes (€) | 800 | 1.200 | 1.600 | 3.000 |
| Clientes en 6 meses | 60 | 90 | 120 | 225 |
| Facturación en 6 meses (€) | 12.000 | 18.000 | 24.000 | 45.000 |
| Margen en 6 meses (€) | 4.800 | 7.200 | 9.600 | 18.000 |
| Resultado tras inversión (€) | 4.800 | 4.200 | 6.600 | 15.000 |
| Margen adicional/mes (€) | — | 400 | 800 | 2.200 |
| Resultado adicional a 6 meses (€) | referencia | −600 | 1.800 | 10.200 |
| ROI incremental a 6 meses | no aplica | −20 % | 60 % | 340 % |
| Recuperación teórica (meses) | no aplica | 7,5 (fuera) | 3,75 | 1,363636… |
| Primer cierre mensual recuperado | no aplica | mes 8 (fuera) | mes 4 | mes 2 |

En el escenario intermedio hay 9.600 € de margen acumulado; después de 3.000 € de inversión quedan 6.600 €. Como la situación inicial ya habría generado 4.800 €, la mejora atribuida al conjunto de supuestos es 1.800 €, no 6.600 €. Si no se cumplen las visitas, consultas, cierre o margen asumidos, estos resultados cambian.

## Precisión y validación

Se calcula con números de doble precisión sin redondeos intermedios. La interfaz usa formato español, hasta dos decimales en euros y ratios; los resultados exactos se prueban con tolerancia numérica. Las etiquetas de recuperación dentro/fuera se deciden con el valor interno, no con el redondeado. Se comprueba que las entradas sean números finitos dentro de su dominio; números vacíos, texto, infinito y NaN no son válidos. Los estados indefinidos se representan explícitamente, nunca como división por cero.

La interfaz acepta coma o punto decimal sin separadores de miles (`1500,50` o `1500.50`); `1.500` se interpreta como 1,5. Se conserva el texto exacto del borrador, incluidas entradas incompletas como `20,` o `-`, que suspenden el cálculo hasta completarse. El núcleo de cálculo recibe solo números ya interpretados y validados.

Los valores no nulos que se redondearían a cero se indican como «< 0,01» o «Entre −0,01 y 0», con su unidad. Una recuperación posterior al horizonte que redondearía al mismo mes se muestra como «Más de T meses». Estas reglas mejoran la presentación sin cambiar las fórmulas ni las decisiones numéricas del modelo.
