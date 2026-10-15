# STRUX structural engine

Pure TypeScript, no UI imports (only the adapter `toAnalysisInput` reads the editor model type).

- `types.ts` — physical model, units (m, kN, kN/m, kN·m) and sign conventions.
- `solver.ts` — classification (hypostatic / isostatic / hyperstatic) and reactions by equilibrium in the beam's local axes.
- `postprocess.ts` — V(x), M(x), N(x) by the method of sections (left free body), diagram samples with left/right limits at discontinuities, exact zero-shear points.
- `index.ts` — adapter from the editor model and `analyzeBeam` entry point.
- The editor calls `analyzeModel` only on an explicit Calcular action. Results are tied to the immutable model snapshot used for analysis and are hidden as stale after edits.

## Supported (v0.2)

- Straight beam at an angle from global horizontal, with vertical point forces and distributed gravity loads resolved into local axial and transverse components; distributed loads may alternatively act normal to the beam or be specified per metre of horizontal projection.
- Pinned + roller at distinct positions (overhangs allowed); single fixed support (cantilever).
- Normal force N(x), shear V(x), bending moment M(x), global reactions and global equilibrium residuals.

## Not supported

Hyperstatic beams, two rollers, hinges, trapezoidal loads, displacements/rotations (no EI in the model), frames.

In the beam editor, the beam angle is measured counter-clockwise from global +x and is limited to ±60°. Each support follows the beam by default, but its angle can be set independently from −180° to 180°; rollers react normal to their support axis. Point forces and gravity-directed distributed loads remain vertical in global coordinates. A distributed load can instead be set perpendicular to the beam or per metre of horizontal projection. In projection mode, the load length is measured along the beam and its intensity is converted using the beam's horizontal projection. Reactions are reported in global x/y; V, M, and N diagrams use local beam coordinates.

## 2D frames and trusses

`frame-types.ts` and `frame-solver.ts` define a separate planar model and direct-stiffness solver. Coordinates are global x/y in m; nodal forces are kN and moments kN·m; E is kN/m², A is m², I is m⁴. Frame members use an Euler-Bernoulli 2D element with local axial and bending stiffness and three DOFs per active node (ux, uy, rz). Truss members contribute axial stiffness only and do not carry joint moments. Frame-member start and end rotations can be released independently; each release has its own internal rotational DOF and transmits no end moment.

Linear load intensity varies between `qStart` and `qEnd` along the entire member, in kN/m. With no angle it acts in the member's local +y direction; an entered angle sets its global direction from +x. Both axial and transverse consistent nodal loads are included. Nodal force components are rotated counter-clockwise from their local axes by the entered global angle; couples remain unchanged. Support `angle` rotates the local ux/uy restraint axes counter-clockwise from global x. Frame-member end rotations can be released independently, producing zero end moment at that hinge.

Ordinary truss members carry tension and compression. Tie members (`kind: "tie"`) are active only in tension and struts (`kind: "strut"`) only in compression; their active states are solved iteratively and unstable/nonconvergent mechanisms fail explicitly. The solver returns nodal displacements, global support reactions, member end actions and global equilibrium residuals.

The editor includes editable node coordinates, rotated restraints, member end releases, member connectivity and E/A/I properties, oriented nodal and distributed loads, and examples for simple portals, combined triangular and lateral portal loads, three-hinged portals, pin-jointed braced portals and triangular trusses. Tie/strut tools add unilateral members to arbitrary models. Limitations include finite-rotation behavior, second-order effects, shear deformation, buckling, plasticity, design checks and out-of-plane response. Frame/truss results are not professional design certification.

Analytic tests cover the specified centered point load, full-span and partial-span uniform loads, cantilever tip load, equilibrium, sign conventions, invalid models and boundary cases. Passing these tests validates only these supported models and is not professional certification.

## Next step: direct stiffness method

Add `EI` to the model, Euler-Bernoulli beam elements (2 DOF/node: v, θ), assemble K, apply supports as restrained DOFs, equivalent nodal loads for spans, solve K·d = F, recover end forces and reuse `postprocess` for diagrams. Validate against the same analytic tests plus hyperstatic cases (propped cantilever, two-span continuous beam) before enabling them in the UI.

## Reference

Vetin Beam (github.com/rasimtemur/vetin-beam, MIT) was reviewed as a reference only. No code was copied, so no notice is required.
