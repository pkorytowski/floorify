import type { Project } from "../types";
import type { Door, Room } from "../types";

import { NumericField } from "./NumericField";

type DoorCardProps = {
  door: Door;
  unit: Project["unit"];
  rooms: Room[];
  editMode: boolean;
  onChange: (door: Door) => void;
  onDelete: () => void;
};

export function DoorCard({ door, unit, rooms, editMode, onChange, onDelete }: DoorCardProps) {
  return (
    <article className="door-card">
      <div className="door-header">
        <strong>{door.name}</strong>
        <button className="danger" type="button" onClick={onDelete} disabled={!editMode}>Usuń</button>
      </div>
      <div className="grid two compact-grid">
        <label>
          Pokój A
          <select value={door.roomAId} disabled={!editMode} onChange={(event) => onChange({ ...door, roomAId: event.target.value })}>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        </label>
        <label>
          Pokój B
          <select value={door.roomBId} disabled={!editMode} onChange={(event) => onChange({ ...door, roomBId: event.target.value })}>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        </label>
        <NumericField label="X1" value={door.start.x} unit={unit} disabled={!editMode} onChange={(value) => onChange({ ...door, start: { ...door.start, x: value } })} />
        <NumericField label="Y1" value={door.start.y} unit={unit} disabled={!editMode} onChange={(value) => onChange({ ...door, start: { ...door.start, y: value } })} />
        <NumericField label="X2" value={door.end.x} unit={unit} disabled={!editMode} onChange={(value) => onChange({ ...door, end: { ...door.end, x: value } })} />
        <NumericField label="Y2" value={door.end.y} unit={unit} disabled={!editMode} onChange={(value) => onChange({ ...door, end: { ...door.end, y: value } })} />
      </div>
    </article>
  );
}
