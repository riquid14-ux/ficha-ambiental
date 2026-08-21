# Análise — Ficha histórica PDF TSL

## Ficheiro analisado
- `SIN0201-TSL-XX-XX-RP-N-00053.pdf`
- 97 páginas

## Estrutura observada
- Cabeçalho com metadados: empresa, projecto, referência documental, data, semana de trabalho.
- Tabela principal por medida com colunas: número, descrição, responsável, implementação (`I`, `C`, `NC`, `NA`) e `Observações / Evidências`.
- Há fotos embebidas dentro da coluna de evidências em várias páginas.
- As medidas podem ocupar mais de uma página.

## Conclusões para importação histórica
- **Texto e estados**: o formato é suficientemente estruturado para extrair medidas, estados e observações com LLM/document parsing.
- **Fotos**: existem imagens reais no PDF e podem ser extraídas, mas a associação automática de cada foto à medida exacta exige lógica adicional.
- **Metadados**: projecto, semana, empresa e referência parecem extraíveis com boa fiabilidade.

## Estado actual da app
- A importação actual consegue tratar bem a componente textual/estrutural.
- A gravação automática das fotos como evidências por medida ainda requer desenvolvimento adicional.
