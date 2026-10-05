import { NextResponse } from "next/server";
import { getCustomerById, updateCustomerById, deleteCustomerById } from "@/lib/services/mongodbService";
import { getSessionUser, unauthorizedResponse } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Customer ID is required." },
        { status: 400 }
      );
    }

    const customer = await getCustomerById(id);

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error("[customers/[id]] Error:", error.message);
    return NextResponse.json(
      { success: false, message: "Failed to fetch customer." },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Customer ID is required." },
        { status: 400 }
      );
    }

    const update = {};
    const fields = [
      "customerName", "fullAddressWithGST", "fullAddress", "gstNo",
      "stateName", "stateCode",
      "contactPerson", "contactNumber", "designation",
      "emailTo", "emailCc", "location", "userId", "engineerRemark",
    ];
    for (const f of fields) {
      if (body[f] !== undefined) {
        update[f] = String(body[f]).trim();
      }
    }

    if (update.customerName !== undefined && !update.customerName) {
      return NextResponse.json(
        { success: false, message: "Customer name is required." },
        { status: 422 }
      );
    }

    const customer = await updateCustomerById(id, update);

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer updated successfully.",
      data: customer,
    });
  } catch (error) {
    console.error("[customers/PUT] Error:", error.message);
    return NextResponse.json(
      { success: false, message: "Failed to update customer." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Customer ID is required." },
        { status: 400 }
      );
    }

    const existing = await getCustomerById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Customer not found." },
        { status: 404 }
      );
    }

    await deleteCustomerById(id);

    return NextResponse.json({
      success: true,
      message: "Customer deleted successfully.",
    });
  } catch (error) {
    console.error("[customers/DELETE] Error:", error.message);
    return NextResponse.json(
      { success: false, message: "Failed to delete customer." },
      { status: 500 }
    );
  }
}