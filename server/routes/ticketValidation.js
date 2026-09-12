const textFields = ["ticket_number", "train_no", "departure_station", "arrival_station", "travel_date", "departure_time", "seat_type", "seat_no", "sell_place", "gate_info", "message", "theme"];

export const validTicket = ticket => {
    if (!ticket || typeof ticket !== "object" || Array.isArray(ticket)) return false;
    for (const field of textFields) {
        const value = ticket[field];
        if (value != null && (typeof value !== "string" || value.length > (field === "message" ? 2000 : 200))) return false;
    }
    for (const field of ["price", "distance", "use_credit", "has_conditioner"]) {
        const value = ticket[field];
        if (value == null || value === "") continue;
        if (!["number", "string", "boolean"].includes(typeof value)) return false;
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0 || number > 10000000) return false;
        if (["use_credit", "has_conditioner"].includes(field) && ![0, 1].includes(number)) return false;
    }
    return true;
};

export const ticketQuota = 10000;
