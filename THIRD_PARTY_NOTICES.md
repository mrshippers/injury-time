# Third-party notices

## BodyApps 3D body visualiser (OpnTec)

The player figure is the male base body from **OpnTec/bodyapps-viz**
(https://github.com/OpnTec/bodyapps-viz), licensed under the
**GNU Lesser General Public License v3.0**. The mesh and its seventeen
measurement morphs were converted by `scripts/convert-body.ts` into
`public/body/athlete.bin` and `public/body/athlete.json` (twelve morphs kept,
smooth normals recomputed, positions rescaled to metres). The asset is loaded
at runtime as a separate file and can be replaced with any other build of the
same model; nothing in the application code is derived from the library
beyond the measurement-to-influence formula documented in its README.

The original licence text is at
https://www.gnu.org/licenses/lgpl-3.0.html.
