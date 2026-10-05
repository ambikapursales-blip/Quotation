"use client";

import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ItemRow from "@/components/quotations/ItemRow";
import NewPartModal from "@/components/quotations/NewPartModal";

export default function ItemListSection({ items, errors, onAdd, onRemove, onChangeItem }) {
  const [showNewPartModal, setShowNewPartModal] = useState(false);
  const [newPartTargetRowId, setNewPartTargetRowId] = useState(null);

  const handleAddNewPart = useCallback((rowId) => {
    setNewPartTargetRowId(rowId);
    setShowNewPartModal(true);
  }, []);

  const handleCloseNewPartModal = useCallback(() => {
    setShowNewPartModal(false);
    setNewPartTargetRowId(null);
  }, []);

  const handleNewPartSuccess = useCallback((newPart) => {
    if (newPartTargetRowId) {
      onChangeItem(newPartTargetRowId, "partNumber", newPart.partNo);
      onChangeItem(newPartTargetRowId, "partDescription", newPart.description || "");
      onChangeItem(newPartTargetRowId, "priceWef", newPart.applicableDate || "");
      onChangeItem(newPartTargetRowId, "availability", newPart.stockStatus || "");
      onChangeItem(newPartTargetRowId, "unitPrice", newPart.standardRate != null ? String(newPart.standardRate) : "");
      onChangeItem(newPartTargetRowId, "liveStock", newPart.totalQty != null ? String(newPart.totalQty) : "");
      onChangeItem(newPartTargetRowId, "hsnCode", newPart.hsnCode || "");
      onChangeItem(newPartTargetRowId, "group", newPart.group || "");
      onChangeItem(newPartTargetRowId, "subGroup", newPart.subGroup || "");
      onChangeItem(newPartTargetRowId, "lastPurchaseDate", newPart.lastPurchaseDate != null ? String(newPart.lastPurchaseDate) : "");
      onChangeItem(newPartTargetRowId, "totalQty", newPart.totalQty != null ? String(newPart.totalQty) : "");
      onChangeItem(newPartTargetRowId, "totalPrice", newPart.totalPrice != null ? String(newPart.totalPrice) : "");
      onChangeItem(newPartTargetRowId, "otherRate", "");
    }
    setShowNewPartModal(false);
    setNewPartTargetRowId(null);
  }, [newPartTargetRowId, onChangeItem]);

  return (
    <>
      <CardHeader
        eyebrow="Step 3"
        title="Item List"
        description="Add every part included in this quotation."
        action={
          <Badge tone="accent">
            {items.length} {items.length === 1 ? "item" : "items"}
          </Badge>
        }
      />
      <CardBody className="space-y-4">
        {errors["items"] && (
          <p className="text-sm font-medium text-danger-500">{errors["items"]}</p>
        )}
        {items.map((row, index) => (
          <ItemRow
            key={row.id}
            index={index}
            row={row}
            errors={errors}
            onChange={onChangeItem}
            onRemove={onRemove}
            canRemove={items.length > 1}
            onAddNewPart={handleAddNewPart}
            rowId={row.id}
          />
        ))}

        <Button variant="subtle" icon={Plus} onClick={onAdd} className="w-full sm:w-auto">
          Add Item
        </Button>
      </CardBody>

      <NewPartModal
        isOpen={showNewPartModal}
        onClose={handleCloseNewPartModal}
        onSuccess={handleNewPartSuccess}
      />
    </>
  );
}
