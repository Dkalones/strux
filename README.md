# Viga Studio

Crie o projeto STRUX, uma aplicação web de análise de vigas estruturais, com interface técnica moderna, limpa e intuitiva, em português brasileiro. Esta é a primeira etapa: construir a interface visual e o editor interativo, sem afirmar que cálculos estruturais já estão validados.

Objetivo da primeira versão:
- Área central de desenho em SVG responsiva, com grade e régua dinâmica horizontal em metros.
- Uma viga horizontal inicial, com comprimento configurável e escala coerente.
- Barra lateral de ferramentas para adicionar apoios (articulado, rolete e engaste), força concentrada, carga distribuída uniforme e momento concentrado.
- Elementos estruturais e cargas devem poder ser selecionados e arrastados; permitir editar propriedades num painel lateral/modal simples.
- Símbolos técnicos vetoriais em SVG, com linhas legíveis e visual consistente.
- Painel de propriedades que mostre posição, comprimento e intensidade da carga em unidades claras.
- Estrutura visual preparada para no futuro mostrar diagramas de esforço cortante e momento fletor, resultados e reações, mas por enquanto indicar claramente quando esses resultados ainda não foram calculados.
- Botões para desfazer/refazer, limpar modelo e ajustar à tela, funcionando quando viável.
- Design responsivo para desktop, estética de software de engenharia profissional, sem excesso de gradientes ou elementos decorativos.
- Criar componentes organizados e tipos de dados claros para viga, apoios, cargas e unidades.
- Incluir alguns exemplos iniciais simples e uma área de status.
- Não copiar código de outro projeto sem que os arquivos e licenças tenham sido efetivamente inspecionados. Planejar uma possível integração futura com Vetin Beam, cuja licença informada é MIT, mas não presumir nomes de arquivos ou dependências.
- Não conectar banco de dados ou autenticação nesta primeira etapa.
Comece construindo um protótipo funcional da interface e do editor de desenho.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d9f05377-88cd-45a0-ad37-bb3c98060f71).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
