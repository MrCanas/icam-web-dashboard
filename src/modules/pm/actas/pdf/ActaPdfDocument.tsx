import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { getCategoryGroupStyle } from "@/modules/pm/actas/logic/category-group-style";
import { ELEMENT_STATUS_LABEL } from "@/modules/pm/actas/logic/element-status";
import {
  formatActaEntryDateTime,
  formatActaRangeDate,
} from "@/modules/pm/actas/logic/actas-time";

import type { ActaPdfProps } from "./acta-pdf-types";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    lineHeight: 1.45,
    color: "#1a1a1a",
  },
  coverPage: {
    paddingTop: 72,
    justifyContent: "flex-start",
  },
  coverTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 12,
    marginBottom: 24,
    color: "#333",
  },
  coverMeta: {
    fontSize: 10,
    marginBottom: 6,
    color: "#444",
  },
  coverFilters: {
    fontSize: 9,
    marginTop: 16,
    color: "#555",
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#666",
    textAlign: "center",
  },
  categoryHeader: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    borderRadius: 2,
  },
  categoryTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  categoryCount: {
    fontSize: 9,
    marginTop: 2,
  },
  elementTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 10,
  },
  entryBlock: {
    marginBottom: 10,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: "#e0e0e0",
  },
  entryMeta: {
    fontSize: 9,
    color: "#555",
    marginBottom: 3,
  },
  entryContent: {
    fontSize: 10,
    color: "#1a1a1a",
  },
  entryStatus: {
    fontSize: 9,
    color: "#444",
    marginTop: 4,
    fontStyle: "italic",
  },
  emptyNote: {
    fontSize: 11,
    marginTop: 32,
    color: "#555",
    textAlign: "center",
  },
});

function PageFooter({ projectCode }: { projectCode: string }) {
  return (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) =>
        `Acta ${projectCode} — Página ${pageNumber} de ${totalPages}`
      }
    />
  );
}

function formatGeneratedAt(d: Date): string {
  return formatActaEntryDateTime(d.toISOString());
}

export function ActaPdfDocument({
  projectCode,
  projectName,
  dateFrom,
  dateTo,
  generatedAt,
  filterLines,
  viewData,
}: ActaPdfProps) {
  const totalEntries = viewData.totalEntryCount;

  return (
    <Document
      title={`Acta ${projectCode}`}
      author="ICAM Capital"
      subject={`Acta de seguimiento ${projectCode}`}
    >
      <Page size="A4" style={[styles.page, styles.coverPage]}>
        <Text style={styles.coverTitle}>ACTA — {projectCode}</Text>
        <Text style={styles.coverSubtitle}>{projectName}</Text>
        <Text style={styles.coverMeta}>
          Período: {formatActaRangeDate(dateFrom)} al {formatActaRangeDate(dateTo)}
        </Text>
        <Text style={styles.coverMeta}>
          Generado el {formatGeneratedAt(generatedAt)}
        </Text>
        <Text style={styles.coverMeta}>
          Entradas: {totalEntries}
          {totalEntries === 1 ? "" : ""}
        </Text>
        {filterLines.length > 0 ? (
          <View style={styles.coverFilters}>
            {filterLines.map((line) => (
              <Text key={line}>{line}</Text>
            ))}
          </View>
        ) : null}
        {totalEntries === 0 ? (
          <Text style={styles.emptyNote}>
            0 entradas en este período con los filtros aplicados.
          </Text>
        ) : null}
        <PageFooter projectCode={projectCode} />
      </Page>

      {viewData.categories.map((category) => {
        const groupStyle = getCategoryGroupStyle(
          category.masterGroupId,
          category.id,
        );
        return (
          <Page key={category.id} size="A4" style={styles.page} wrap>
            <View
              style={[
                styles.categoryHeader,
                { backgroundColor: groupStyle.bg },
              ]}
            >
              <Text style={[styles.categoryTitle, { color: groupStyle.text }]}>
                {category.displayName}
              </Text>
              <Text style={[styles.categoryCount, { color: groupStyle.text }]}>
                {category.entryCount}{" "}
                {category.entryCount === 1 ? "entrada" : "entradas"} en este
                rango
              </Text>
            </View>

            {category.elements.map((element) => (
              <View key={element.id} style={{ marginLeft: element.depth * 14 }}>
                <Text style={styles.elementTitle}>
                  {element.name} ({element.entryCount}{" "}
                  {element.entryCount === 1 ? "entrada" : "entradas"})
                </Text>
                {element.entries.map((entry) => {
                  const authorLabel =
                    entry.author?.label ??
                    (entry.authorId ? "Usuario" : "Sin autor");
                  const hasStatus =
                    entry.statusBefore != null && entry.statusAfter != null;
                  return (
                    <View key={entry.id} style={styles.entryBlock} wrap>
                      <Text style={styles.entryMeta}>
                        {formatActaEntryDateTime(entry.entryDate)} —{" "}
                        {authorLabel}
                      </Text>
                      <Text style={styles.entryContent}>{entry.content}</Text>
                      {hasStatus ? (
                        <Text style={styles.entryStatus}>
                          Estado:{" "}
                          {ELEMENT_STATUS_LABEL[entry.statusBefore!]} →{" "}
                          {ELEMENT_STATUS_LABEL[entry.statusAfter!]}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}

            <PageFooter projectCode={projectCode} />
          </Page>
        );
      })}
    </Document>
  );
}
