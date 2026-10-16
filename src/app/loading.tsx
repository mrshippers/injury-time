/** Shown the instant a link is tapped, while the next page renders: a slanted bar sweeping under the nav. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="loading" className="relative flex-1">
      <span aria-hidden className="route-bar plate absolute left-0 top-0 h-[3px] w-1/3 bg-mint" />
    </div>
  );
}
