// The one way to reach the organisers this season: an issue on the repo.
export const ISSUES_URL = "https://github.com/dhairya-pandya/papersseum/issues";

export function ContactOrganisers({ lead }: { lead: string }) {
  return (
    <p className="muted">
      {lead}{" "}
      <a href={ISSUES_URL} target="_blank" rel="noreferrer">
        Open an issue on GitHub
      </a>{" "}
      and an organiser will sort it out.
    </p>
  );
}
