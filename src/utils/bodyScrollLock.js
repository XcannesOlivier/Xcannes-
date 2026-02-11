let lockCount = 0;
let savedStyles = null;

export function lockBodyScroll() {
  if (typeof document === "undefined") return () => {};

  const { body, documentElement: html } = document;

  if (lockCount === 0) {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    savedStyles = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      scrollY,
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  lockCount += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;

    if (lockCount > 0) lockCount -= 1;
    if (lockCount !== 0 || !savedStyles) return;

    html.style.overflow = savedStyles.htmlOverflow;
    body.style.overflow = savedStyles.bodyOverflow;
    body.style.paddingRight = savedStyles.bodyPaddingRight;
    body.style.position = savedStyles.bodyPosition;
    body.style.top = savedStyles.bodyTop;
    body.style.width = savedStyles.bodyWidth;
    window.scrollTo(0, savedStyles.scrollY || 0);
    savedStyles = null;
  };
}
