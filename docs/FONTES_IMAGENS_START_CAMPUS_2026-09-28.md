# Fotografias institucionais — cabeçalhos da plataforma

## Fonte autorizada

As fotografias usadas como *fallback* dos cabeçalhos foram descarregadas da biblioteca oficial de marca da Start Campus em **28-09-2026**:

- Página de origem: https://www.startcampus.pt/brand
- Biblioteca de imagens: `https://www.startcampus.pt/hubfs/Images/Webiste/Start_Campus__%20(n).jpg`, para os números 1, 2, 4–19.
- Orientação de marca publicada na mesma página: utilização da tipografia **Figtree**.

## Tratamento na plataforma

1. Os originais de trabalho estão guardados fora do repositório em `/home/ubuntu/webdev-static-assets/start-campus-brand/`.
2. As cópias usadas pela aplicação foram carregadas para o armazenamento web protegido da plataforma.
3. Cada fallback é mapeado por página em `client/src/lib/brand-images.ts`, sem repetições entre páginas vizinhas.
4. O administrador pode substituir cada fotografia através de **Administração > Imagens**; o ficheiro carregado mantém-se no armazenamento da plataforma e a associação fica registada em `app_settings`.

> A origem é mantida para rastreabilidade interna. Não são descarregadas imagens de sites de terceiros nem utilizadas imagens genéricas.
***
