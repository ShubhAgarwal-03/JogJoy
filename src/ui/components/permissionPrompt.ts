/** Shows/hides the dedicated permission-error screen. Kept trivial on
 *  purpose — the explanatory copy lives in index.html since it's static. */
export function showPermissionError(onRetry: () => void): void {
  const screen = document.getElementById("screen-permission-error")!;
  const retryBtn = document.getElementById("btn-retry-permission")!;

  screen.hidden = false;

  const handleRetry = () => {
    screen.hidden = true;
    retryBtn.removeEventListener("click", handleRetry);
    onRetry();
  };
  retryBtn.addEventListener("click", handleRetry);
}

export function hidePermissionError(): void {
  document.getElementById("screen-permission-error")!.hidden = true;
}