export const INSERT_TICKET_SQL = `
    INSERT INTO tickets (
        user_id, ticket_number, train_no,
        departure_station, arrival_station,
        travel_date, departure_time,
        price, use_credit,
        seat_type, has_conditioner,
        seat_no, sell_place, gate_info,
        message, theme, distance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
