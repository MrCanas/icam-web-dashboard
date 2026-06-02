"use client";

import { childContainerKey, rootContainerKey } from "@/modules/pm/actas/logic/operativo-dnd";
import type { ActasOperativoElement, ElementStatus } from "@/modules/pm/actas/types";

import { ActasElementRow } from "./ActasElementRow";
import { ActasOperativoElementContainer } from "./ActasOperativoElementContainer";
import {
  OperativoElementSortableList,
  useOperativoDnd,
} from "./ActasOperativoDndContext";
import { ActasOperativoSortableElement } from "./ActasOperativoSortableElement";

interface ActasOperativoElementBranchProps {
  element: ActasOperativoElement;
  categoryId: string;
  depth?: number;
  projectCode: string;
  currentAuthUserId: string | null;
  isPmAdmin?: boolean;
  hasWriteAccess?: boolean;
  readOnly?: boolean;
  asOfDate?: string;
  showAsCompleted?: boolean;
  onElementStatusLiveChange?: (
    elementId: string,
    status: ElementStatus,
  ) => void;
  onElementArchived?: (message: string) => void;
  onToast?: (message: string) => void;
}

export function ActasOperativoElementBranch({
  element,
  categoryId,
  depth = 0,
  projectCode,
  currentAuthUserId,
  isPmAdmin = false,
  hasWriteAccess = true,
  readOnly = false,
  asOfDate,
  showAsCompleted = false,
  onElementStatusLiveChange,
  onElementArchived,
  onToast,
}: ActasOperativoElementBranchProps) {
  const dnd = useOperativoDnd();
  const childContainer = childContainerKey(element.id);
  const childMap = new Map(element.children.map((c) => [c.id, c]));

  return (
    <ActasOperativoSortableElement
      elementId={element.id}
      showNestDropZone={element.canHaveSubelements && !readOnly}
    >
      {({ dragHandle }) => (
        <>
          <ActasElementRow
            element={element}
            depth={depth}
            projectCode={projectCode}
            currentAuthUserId={currentAuthUserId}
            isPmAdmin={isPmAdmin}
            hasWriteAccess={hasWriteAccess}
            readOnly={readOnly}
            asOfDate={asOfDate}
            showAsCompleted={showAsCompleted}
            dragHandle={dragHandle}
            onElementStatusLiveChange={onElementStatusLiveChange}
            onElementArchived={onElementArchived}
            onToast={onToast}
          />

          {element.canHaveSubelements ? (
            <OperativoElementSortableList
              containerKey={childContainer}
              categoryId={categoryId}
              parentElementId={element.id}
            >
              {(ids) => (
                <ActasOperativoElementContainer
                  containerKey={childContainer}
                  className={ids.length === 0 ? "min-h-[2px]" : undefined}
                >
                  {ids.map((childId) => {
                    const child = childMap.get(childId);
                    if (!child) return null;
                    return (
                      <ActasOperativoElementBranch
                        key={child.id}
                        element={child}
                        categoryId={categoryId}
                        depth={depth + 1}
                        projectCode={projectCode}
                        currentAuthUserId={currentAuthUserId}
                        isPmAdmin={isPmAdmin}
                        hasWriteAccess={hasWriteAccess}
                        readOnly={readOnly}
                        asOfDate={asOfDate}
                        showAsCompleted={
                          showAsCompleted && child.status === "done"
                        }
                        onElementStatusLiveChange={onElementStatusLiveChange}
                        onElementArchived={onElementArchived}
                        onToast={onToast}
                      />
                    );
                  })}
                </ActasOperativoElementContainer>
              )}
            </OperativoElementSortableList>
          ) : null}
        </>
      )}
    </ActasOperativoSortableElement>
  );
}

export function OperativoCategoryRootList({
  categoryId,
  elements,
  ...branchProps
}: Omit<ActasOperativoElementBranchProps, "element" | "categoryId"> & {
  categoryId: string;
  elements: ActasOperativoElement[];
}) {
  const dnd = useOperativoDnd();
  const containerKey = rootContainerKey(categoryId);
  const rootMap = new Map(elements.map((e) => [e.id, e]));

  const renderRoots = (ids: string[]) =>
    ids
      .map((id) => rootMap.get(id))
      .filter((e): e is ActasOperativoElement => e != null)
      .map((el) => (
        <ActasOperativoElementBranch
          key={el.id}
          element={el}
          categoryId={categoryId}
          {...branchProps}
          showAsCompleted={
            Boolean(branchProps.showAsCompleted) && el.status === "done"
          }
        />
      ));

  if (!dnd?.enabled) {
    return <>{renderRoots(elements.map((e) => e.id))}</>;
  }

  return (
    <OperativoElementSortableList
      containerKey={containerKey}
      categoryId={categoryId}
      parentElementId={null}
    >
      {(ids) => (
        <ActasOperativoElementContainer
          containerKey={containerKey}
          className={ids.length === 0 ? "min-h-[2px]" : undefined}
        >
          {renderRoots(ids)}
        </ActasOperativoElementContainer>
      )}
    </OperativoElementSortableList>
  );
}
