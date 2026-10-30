
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";
import {
  loadAppUser,
  getAccessibleDistributors,
} from "../lib/access";

const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

function isDistributorMappedToSO(distributor, soEmail) {
  const email = normalizeEmail(soEmail);

  const mappedEmails = Array.isArray(distributor.mapped_SO_emails)
    ? distributor.mapped_SO_emails.map(normalizeEmail)
    : [];

  const legacyEmail = normalizeEmail(distributor.mapped_SO_email);

  return mappedEmails.includes(email) || legacyEmail === email;
}

export default function NewStorePage() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [allDistributors, setAllDistributors] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    city: "",
    locality: "",
    address: "",
    owner: "",
    mobile: "",
    distributor_id: "",
    type: "GT",
    focus: false,
  });

  const [assignedSO, setAssignedSO] = useState("");
  const [gps, setGps] = useState("Fetching...");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "Admin";

  // Derive available distributors from the selected SO.
  const distributors = isAdmin
    ? assignedSO
      ? allDistributors.filter((distributor) =>
          isDistributorMappedToSO(distributor, assignedSO)
        )
      : []
    : allDistributors;

  // Load authorized user, distributors and registered SO users.
  useEffect(() => {
    let active = true;

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser?.email) {
        if (active) setLoading(false);
        return;
      }

      try {
        const userProfile = await loadAppUser(firebaseUser, db);

        if (!active) return;

        setProfile(userProfile);

        const dists = await getAccessibleDistributors(
          db,
          userProfile.email,
          userProfile.role === "Admin"
        );

        if (!active) return;

        setAllDistributors(dists);

        if (userProfile.role === "Admin") {
          const usersSnapshot = await getDocs(collection(db, "users"));

          if (!active) return;

          const soUsers = usersSnapshot.docs
            .map((doc) => doc.data())
            .filter(
              (user) =>
                String(user.role || "").trim().toUpperCase() === "SO"
            )
            .map((user) => ({
              ...user,
              email: normalizeEmail(user.email),
            }))
            .filter((user) => user.email)
            .sort((a, b) =>
              String(a.name || a.email).localeCompare(
                String(b.name || b.email)
              )
            );

          setUsers(soUsers);
        }
      } catch (error) {
        console.error("Unable to load New Store data:", error);
        alert(error.message || "Unable to load store form data.");
      } finally {
        if (active) setLoading(false);
      }
    });

    // Initial GPS capture.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setGps(
            `${pos.coords.latitude}, ${pos.coords.longitude}`
          ),
        () => setGps("Location Denied")
      );
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSOChange = (email) => {
    setAssignedSO(normalizeEmail(email));

    // Clear previous distributor whenever the SO changes.
    setFormData((prev) => ({
      ...prev,
      distributor_id: "",
    }));
  };

  const captureGPS = () => {
    if (!navigator.geolocation) {
      setGps("GPS not supported");
      return;
    }

    setGps("Fetching...");

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps(
          `${pos.coords.latitude}, ${pos.coords.longitude}`
        ),
      (error) => {
        console.error("GPS error:", error);
        setGps("Location Denied");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!profile || !auth.currentUser) {
      alert("Please login again.");
      return;
    }

    if (
      !formData.name.trim() ||
      !formData.city.trim() ||
      !formData.owner.trim() ||
      !formData.distributor_id
    ) {
      alert("Please fill all required fields.");
      return;
    }

    // Admin must select a registered SO.
    if (isAdmin && !assignedSO) {
      alert("Please select a Sales Officer.");
      return;
    }

    const soEmail = isAdmin
      ? normalizeEmail(assignedSO)
      : normalizeEmail(profile.email);

    // Validate selected SO against registered SO profiles.
    if (isAdmin) {
      const selectedSO = users.find(
        (user) => user.email === soEmail
      );

      if (!selectedSO) {
        alert("Selected Sales Officer is not valid.");
        return;
      }
    }

    // Validate selected distributor against the available list.
    const selectedDistributor = distributors.find(
      (distributor) => distributor.id === formData.distributor_id
    );

    if (!selectedDistributor) {
      alert("Please select a valid distributor.");
      return;
    }

    if (!isDistributorMappedToSO(selectedDistributor, soEmail)) {
      alert(
        "This distributor is not mapped to the selected Sales Officer."
      );
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "stores"), {
        name: formData.name.trim(),
        city: formData.city.trim(),
        locality: formData.locality.trim(),
        address: formData.address.trim(),
        owner: formData.owner.trim(),
        mobile: formData.mobile.trim(),
        distributor_id: formData.distributor_id,

        // Actual store category.
        type: formData.type,

        // Identifies a newly created store separately.
        store_origin: "NEW",

        focus: formData.focus,

        // SO ownership.
        SO_email: soEmail,

        // GPS and creation information.
        gps: gps,
        createdBy_email: normalizeEmail(profile.email),
        createdAt: new Date().toISOString(),
      });

      alert("Store added successfully!");
      router.push("/stores");
    } catch (error) {
      console.error("Error adding store:", error);

      alert(
        `Error adding store: ${
          error.message || "Please try again."
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-800 to-purple-600 p-4 rounded-b-3xl shadow-lg text-white">
        <h1 className="text-2xl font-black">New Store</h1>
        <p className="text-sm opacity-90 mt-1">
          Add an outlet & start ordering
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 space-y-4 max-w-md mx-auto -mt-4"
      >
        <div className="bg-white p-4 rounded-2xl shadow-sm space-y-3">

          {/* Admin SO Assignment */}
          {isAdmin && (
            <div>
              <label className="text-[10px] font-bold text-gray-500">
                ASSIGN SALES OFFICER *
              </label>

              <select
                required
                value={assignedSO}
                onChange={(e) => handleSOChange(e.target.value)}
                className="w-full p-3 border rounded-xl mt-1 bg-gray-50"
              >
                <option value="">Select Sales Officer...</option>

                {users.map((user) => (
                  <option key={user.email} value={user.email}>
                    {user.name || user.email} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Outlet Name */}
          <div>
            <label className="text-[10px] font-bold text-gray-500">
              OUTLET NAME *
            </label>

            <input
              required
              type="text"
              value={formData.name}
              className="w-full p-3 border rounded-xl mt-1 bg-gray-50"
              onChange={(e) => updateField("name", e.target.value)}
            />
          </div>

          {/* City and Locality */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500">
                CITY *
              </label>

              <input
                required
                type="text"
                value={formData.city}
                className="w-full p-3 border rounded-xl mt-1 bg-gray-50"
                onChange={(e) => updateField("city", e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500">
                LOCALITY
              </label>

              <input
                type="text"
                value={formData.locality}
                className="w-full p-3 border rounded-xl mt-1 bg-gray-50"
                onChange={(e) => updateField("locality", e.target.value)}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="text-[10px] font-bold text-gray-500">
              ADDRESS
            </label>

            <input
              type="text"
              value={formData.address}
              className="w-full p-3 border rounded-xl mt-1 bg-gray-50"
              onChange={(e) => updateField("address", e.target.value)}
            />
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500">
                CONTACT PERSON *
              </label>

              <input
                required
                type="text"
                value={formData.owner}
                className="w-full p-3 border rounded-xl mt-1 bg-gray-50"
                onChange={(e) => updateField("owner", e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500">
                MOBILE
              </label>

              <input
                type="tel"
                value={formData.mobile}
                className="w-full p-3 border rounded-xl mt-1 bg-gray-50"
                onChange={(e) => updateField("mobile", e.target.value)}
              />
            </div>
          </div>

          {/* Distributor */}
          <div>
            <label className="text-[10px] font-bold text-gray-500">
              DISTRIBUTOR *
            </label>

            <select
              required
              disabled={loading || distributors.length === 0}
              value={formData.distributor_id}
              onChange={(e) =>
                updateField("distributor_id", e.target.value)
              }
              className="w-full p-3 border rounded-xl mt-1 bg-gray-50 disabled:opacity-60"
            >
              <option value="">
                {isAdmin && !assignedSO
                  ? "Select Sales Officer first..."
                  : distributors.length === 0
                  ? "No mapped distributor available"
                  : "Select Distributor..."}
              </option>

              {distributors.map((distributor) => (
                <option
                  key={distributor.id}
                  value={distributor.id}
                >
                  {distributor.name}
                </option>
              ))}
            </select>
          </div>

          {/* Store Type and Focus Outlet */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500">
                STORE TYPE
              </label>

              <select
                value={formData.type}
                className="w-full p-3 border rounded-xl mt-1 bg-gray-50"
                onChange={(e) => updateField("type", e.target.value)}
              >
                <option value="GT">GT</option>
                <option value="MT">MT</option>
                <option value="Chemist">Chemist</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500">
                FOCUS OUTLET
              </label>

              <select
                value={formData.focus ? "Yes" : "No"}
                className="w-full p-3 border rounded-xl mt-1 bg-gray-50"
                onChange={(e) =>
                  updateField("focus", e.target.value === "Yes")
                }
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>

          {/* GPS */}
          <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg mt-2 border border-gray-200">
            <button
              type="button"
              onClick={captureGPS}
              className="text-xs font-bold text-blue-700 flex items-center gap-1"
            >
              📍 Capture GPS
            </button>

            <span className="text-[10px] text-gray-500">
              {gps}
            </span>
          </div>
        </div>

        {/* Save */}
        <button
          type="submit"
          disabled={saving || loading}
          className="w-full bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-60"
        >
          {saving
            ? "Saving..."
            : loading
            ? "Loading..."
            : "Save outlet & start order"}
        </button>
      </form>

      <BottomNav />
    </div>
  );
}
