-- Limpa um prefixo de apresentação legado que não pertence ao texto das medidas.
-- Não altera IDs, âmbitos, respostas, submissões, evidências, estados ou auditoria.
-- A separação weekly/DCAPE introduzida em 0068 mantém-se integralmente.
UPDATE `measures`
SET `description` = CASE
  WHEN `description` LIKE 'Medida DCAPE - %' THEN SUBSTRING(`description`, CHAR_LENGTH('Medida DCAPE - ') + 1)
  WHEN `description` LIKE 'DCAPE measure - %' THEN SUBSTRING(`description`, CHAR_LENGTH('DCAPE measure - ') + 1)
  WHEN `description` LIKE 'DCAPE Measure - %' THEN SUBSTRING(`description`, CHAR_LENGTH('DCAPE Measure - ') + 1)
  ELSE `description`
END
WHERE `description` LIKE 'Medida DCAPE - %'
   OR `description` LIKE 'DCAPE measure - %'
   OR `description` LIKE 'DCAPE Measure - %';
