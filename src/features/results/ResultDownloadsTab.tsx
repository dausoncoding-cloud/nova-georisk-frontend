import { Disclosure } from "../../shared/ui/Disclosure";
import { Icon } from "../../shared/ui/Icon";
import { ExportCenter } from "./ExportCenter";
import type { ResultArtifact } from "./gisViewer";
import { displayProductText } from "../../shared/productName";
import { protectedProductUrl } from "./resultsApi";
import { deliveryNote, formatName, formatSize, groupDownloads } from "./resultView";

function DownloadItem({ resultId, artifact }: { resultId: string; artifact: ResultArtifact }) {
  const note = deliveryNote(artifact);
  const size = formatSize(artifact.file_size_bytes);
  const label = displayProductText(artifact.label);
  return (
    <li className="fr-download">
      <span className="fr-download__name"><strong>{label}</strong>{note ? <span>{note}</span> : null}</span>
      <span className="fr-download__meta">{formatName(artifact)}{size ? <> · <span className="fr-num">{size}</span></> : null}</span>
      <a className="fr-button fr-button--secondary fr-download__action" href={protectedProductUrl(resultId, artifact.key)} aria-label={`Download ${label} (${formatName(artifact)}${size ? `, ${size}` : ""})`}>
        <Icon name="exports" width={16} height={16} strokeWidth={2} />Download
      </a>
    </li>
  );
}

export function ResultDownloadsTab({ resultId, artifacts, createdAt }: { resultId: string; artifacts: ResultArtifact[]; createdAt: string }) {
  const { curated, fullPackage, groups } = groupDownloads(artifacts);
  const packageSize = formatSize(fullPackage?.file_size_bytes);
  const packageButton = fullPackage ? (
    <a className="fr-button fr-button--primary" href={protectedProductUrl(resultId, fullPackage.key)} aria-label={`Download the full package (ZIP${packageSize ? `, ${packageSize}` : ""})`}>
      <Icon name="exports" width={16} height={16} strokeWidth={2} />Download full package (.zip){packageSize ? <span className="fr-num"> · {packageSize}</span> : null}
    </a>
  ) : null;

  return <div className="fr-tab-stack">
    <h2 className="fr-visually-hidden">Downloads and GIS layers</h2>
    {!curated ? <>
      {/* Results from older API versions have no deliverable groups: keep the register as it was. */}
      {packageButton ? <div>{packageButton}</div> : null}
      <ExportCenter resultId={resultId} artifacts={artifacts} createdAt={createdAt} />
    </> : <>
      {groups.map((group, index) => {
        const list = <ul className="fr-download-list">{group.artifacts.map((artifact) => <DownloadItem key={artifact.key} resultId={resultId} artifact={artifact} />)}</ul>;
        const headingId = `downloads-${group.key}`;
        return group.collapsed ? (
          <section key={group.key} className="fr-card fr-section" aria-label={group.title}>
            <Disclosure title={`${group.title} (${group.artifacts.length} files)`}><p className="fr-help">{group.description}</p>{list}</Disclosure>
          </section>
        ) : (
          <section key={group.key} className="fr-card fr-section" aria-labelledby={headingId}>
            <div className="fr-section__head"><h3 id={headingId}>{group.title}</h3>{index === 0 ? packageButton : null}</div>
            <p className="fr-help">{group.description}</p>
            {list}
          </section>
        );
      })}
      {groups.length === 0 && packageButton ? <section className="fr-card fr-section">{packageButton}</section> : null}
      <Disclosure title={`All files: search and sort (${artifacts.length})`}>
        <ExportCenter resultId={resultId} artifacts={artifacts} createdAt={createdAt} />
      </Disclosure>
    </>}
    <p className="fr-help">Downloads require sign-in and are available only to your organization.</p>
  </div>;
}
