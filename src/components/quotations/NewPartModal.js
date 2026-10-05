"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/useToast";

const PART_FIELDS = [
  { name: "partNo", label: "Part Number *", type: "text", required: true, placeholder: "Enter part number" },
  { name: "description", label: "Description *", type: "text", required: true, placeholder: "Enter description" },
  { name: "group", label: "Group", type: "text", placeholder: "Enter group" },
  { name: "subGroup", label: "Sub Group", type: "text", placeholder: "Enter sub group" },
  { name: "aRaipur", label: "A RAIPUR", type: "number", step: "0.01", placeholder: "0.00" },
  { name: "bRaigarh", label: "B RAIGARH", type: "number", step: "0.01", placeholder: "0.00" },
  { name: "cAmbikapur", label: "C AMBIKAPUR", type: "number", step: "0.01", placeholder: "0.00" },
  { name: "dSatna", label: "D SATNA", type: "number", step: "0.01", placeholder: "0.00" },
  { name: "lastPurchaseDate", label: "Last Purchase Date", type: "date" },
  { name: "applicableDate", label: "Applicable Date", type: "date" },
  { name: "standardRate", label: "Standard Rate", type: "number", step: "0.01", placeholder: "0.00" },
  { name: "locationRaipur", label: "Location A RAIPUR", type: "text", placeholder: "Enter location" },
  { name: "locationRaigarh", label: "Location B RAIGARH", type: "text", placeholder: "Enter location" },
  { name: "locationAmbikapur", label: "Location C AMBIKAPUR", type: "text", placeholder: "Enter location" },
  { name: "locationSatna", label: "Location D SATNA", type: "text", placeholder: "Enter location" },
  { name: "raipurStockValue", label: "Raipur Stock Value", type: "number", step: "0.01", placeholder: "0.00" },
  { name: "raigarhStockValue", label: "Raigarh Stock Value", type: "number", step: "0.01", placeholder: "0.00" },
  { name: "ambikapurStockValue", label: "Ambikapur Stock Value", type: "number", step: "0.01", placeholder: "0.00" },
  { name: "satnaStockValue", label: "Satna Stock Value", type: "number", step: "0.01", placeholder: "0.00" },
  { name: "stockStatus", label: "Stock Status", type: "text", placeholder: "Enter stock status" },
  { name: "lowStock", label: "Low Stock", type: "number", step: "1", placeholder: "0" },
  { name: "outOfStock", label: "Out of Stock", type: "number", step: "1", placeholder: "0" },
  { name: "inStock", label: "In Stock", type: "number", step: "1", placeholder: "0" },
  { name: "minimumQty", label: "Minimum Qty", type: "number", step: "1", placeholder: "0" },
  { name: "pendingOrderInHO", label: "Pending Order In HO", type: "number", step: "1", placeholder: "0" },
  { name: "needToOrder", label: "Need to Order", type: "number", step: "1", placeholder: "0" },
  { name: "status", label: "Status", type: "text", placeholder: "Enter status" },
  { name: "hsnCode", label: "HSN Code", type: "text", placeholder: "Enter HSN code" },
  { name: "totalQty", label: "Total Qty", type: "number", step: "1", placeholder: "0" },
  { name: "totalPrice", label: "Total Price", type: "number", step: "0.01", placeholder: "0.00" },
];

export default function NewPartModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      setFormData({});
      setErrors({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.partNo?.trim()) newErrors.partNo = "Part Number is required";
    if (!formData.description?.trim()) newErrors.description = "Description is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {};
      for (const [key, value] of Object.entries(formData)) {
        if (value !== "" && value !== undefined && value !== null) {
          payload[key] = value;
        }
      }

      const res = await fetch("/api/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        toast.success("New Part Number created successfully!");
        onSuccess(json.data);
        onClose();
      } else {
        if (json.message?.includes("already exists") || res.status === 409) {
          setErrors({ partNo: "This Part Number already exists." });
        }
        toast.error(json.message || "Failed to create part.");
      }
    } catch (err) {
      toast.error(err.message || "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({});
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-200">
          <h2 className="text-lg font-semibold text-ink-900">Add New Part Number</h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-1 text-ink-400 hover:text-ink-600 rounded-lg hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PART_FIELDS.map((field) => (
              <div
                key={field.name}
                className={cn(
                  field.required ? "md:col-span-1" : "",
                  field.name === "description" ? "md:col-span-2" : ""
                )}
              >
                <Input
                  id={field.name}
                  name={field.name}
                  label={field.label}
                  type={field.type}
                  value={formData[field.name] || ""}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  required={field.required}
                  error={errors[field.name]}
                  step={field.step}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4 border-t border-ink-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Part
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}