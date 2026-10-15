<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## STRUX architecture
- Keep the editor client-side and session-only, with a pure typed model module and separate SVG canvas and properties components; this isolates future solver integration from the visual prototype.
- The structural engine lives in src/lib/structural (pure TS, physical units, documented signs). Run it only when the user clicks Calcular; mark stored results stale whenever the model changes.
- Draw element position dimensions in physical metres. Double-click a dimension and press Enter to move only that support/load in the model; reject positions outside its valid span.
- Keep planar frame/truss analysis in its own typed model and direct-stiffness solver. Frame members require E/A/I; truss members use axial E/A only. Reject unstable systems and unsupported distributed loads rather than returning approximate structural results.
- Only enable support/load cases covered by analytic tests; hyperstatic cases must come via a direct stiffness solver, never ad-hoc formulas.
- Vetin Beam (MIT) is reference only; if code is ever adapted, keep its copyright notice in the adapted file.
