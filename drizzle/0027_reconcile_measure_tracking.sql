-- Reconciliar o progresso legado com o acompanhamento consolidado.
-- Medidas com status updates auditáveis são excluídas e mantêm o estado rico já registado.
UPDATE `phase_measure_statuses` AS `s`
SET `s`.`trackingStatus` = CASE
  WHEN `s`.`status` = 'concluido' THEN 'concluido'
  WHEN `s`.`status` = 'em_curso' THEN 'em_curso'
  ELSE 'nao_iniciado'
END
WHERE `s`.`trackingStatus` = 'nao_iniciado'
  AND `s`.`status` IN ('em_curso', 'concluido')
  AND NOT EXISTS (
    SELECT 1
    FROM `phase_measure_updates` AS `u`
    WHERE `u`.`projectId` = `s`.`projectId`
      AND `u`.`measureId` = `s`.`measureId`
  );
