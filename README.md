# MC Controller

เว็บ Nuxt 4 สำหรับสร้างและดูแล Minecraft หลายเซิร์ฟเวอร์ผ่าน Docker: Vanilla, Fabric, Forge, NeoForge, Paper, Spigot, Bukkit และ CurseForge modpack พร้อมเลือกเวอร์ชันล่าสุดจาก upstream, พอร์ตไม่ซ้ำ, RCON console และ file manager

## เริ่มด้วย Docker Compose

1. คัดลอก `.env.example` เป็น `.env` แล้วกำหนด `JWT_SECRET` เป็นค่าสุ่มยาว ๆ
2. ตั้ง `MC_DATA_HOST_PATH` เป็น **absolute path บน Docker host** เช่น `/opt/mc-controller/data` และสร้างไดเรกทอรีนั้น
3. ตั้ง `WEB_PORT`, `WEB_BIND_IP`, `MC_BIND_IP` และช่วง port Minecraft ตามต้องการ
4. รัน `docker compose up -d --build`
5. เปิด `http://host:WEB_PORT` แล้วระบบจะพาไปสร้างผู้ดูแลคนแรกอัตโนมัติ

พอร์ต Minecraft ถูก publish โดย **container Minecraft แต่ละตัว** ที่แอปสร้างผ่าน Docker socket โดยตรง ไม่ใช่ compose ของ controller จึงไม่มี port ชนกัน. ค่าเริ่มต้นเลือกพอร์ตแรกใน `25565-25600`; เปลี่ยนได้ด้วย `PORT_RANGE_START` และ `PORT_RANGE_END` โดยไม่ต้องแก้ compose เพิ่ม.

### ตั้งค่า IP และ port

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---:|---|
| `WEB_BIND_IP` | `0.0.0.0` | IP ที่เปิด web panel; ตั้งเป็น LAN IP เพื่อจำกัด interface |
| `WEB_PORT` | `3000` | port web panel ฝั่ง host |
| `MC_BIND_IP` | `0.0.0.0` | IP ที่ Minecraft server ทุกตัว bind บน Docker host |
| `PORT_RANGE_START` / `PORT_RANGE_END` | `25565` / `25600` | ช่วง port ที่ระบบเลือกให้ Minecraft |

ตัวอย่าง เปิด panel เฉพาะ LAN IP และให้ Minecraft รับจากทุก interface:

```env
WEB_BIND_IP=192.168.1.10
WEB_PORT=8080
MC_BIND_IP=0.0.0.0
PORT_RANGE_START=25565
PORT_RANGE_END=25600
```

> Firewall/security group ของ Windows, Linux หรือ cloud ยังต้องอนุญาต `WEB_PORT` และช่วง Minecraft เองด้วย.

## Dokploy และ Docker Hub

สร้าง Docker Hub repository ชื่อ `mc-controller` ก่อน แล้ว build/push image เดียวจาก `Dockerfile`:

```sh
docker login
docker build -t DOCKERHUB_USER/mc-controller:1.0.1 .
docker push DOCKERHUB_USER/mc-controller:1.0.1
docker tag DOCKERHUB_USER/mc-controller:1.0.1 DOCKERHUB_USER/mc-controller:latest
docker push DOCKERHUB_USER/mc-controller:latest
```

สำหรับ server Linux/Dokploy ใช้ `docker-compose.prod.yml` และกำหนดอย่างน้อย `DOCKER_HUB_USERNAME`, `IMAGE_TAG`, `JWT_SECRET`, `MC_DATA_HOST_PATH`, `WEB_PORT`, `WEB_BIND_IP`, `MC_BIND_IP`; ถ้าใช้ CurseForge ให้เพิ่ม `CURSEFORGE_API_KEY`. ไฟล์ compose มี bind mount `${MC_DATA_HOST_PATH}:/data` และ `/var/run/docker.sock:/var/run/docker.sock` แล้ว. Publish web panel ผ่าน `WEB_PORT`; Minecraft containers จะ publish port ที่ถูกเลือกจากช่วงโดยอัตโนมัติ.

> Docker socket ให้สิทธิ์สูงมากแก่แอปนี้: อย่าเปิดแผงควบคุมสู่สาธารณะโดยไม่มี HTTPS/การป้องกันเครือข่าย และใช้รหัสผ่านผู้ดูแลที่รัดกุม.

> Windows Docker Desktop: `MC_DATA_HOST_PATH` ต้องเป็น absolute path ที่ Docker Desktop เข้าถึงได้ เช่น `D:/work/mc-controller/data`. สำหรับ Dokploy ให้ใช้ absolute path บน Linux host เช่น `/opt/mc-controller/data`.

> ค่า Linux UID/GID ในหน้า Resources ส่งเป็น `UID`/`GID` ให้ Minecraft image (ค่าเริ่มต้น 1000/1000) เพื่อให้ image จัดสิทธิ์ไฟล์ใน `/data` ได้ตามปกติ.

### Dokploy official template

ไฟล์พร้อมเสนอเข้า Dokploy อยู่ใน `docker/dokploy-template/` และใช้ Docker named volume จึงไม่ต้องกำหนด `MC_DATA_HOST_PATH` เอง. แอปจะอ่าน source ของ volume `/data` จาก Docker daemon แล้ว mount โฟลเดอร์ของ Minecraft server ให้ container ลูกโดยอัตโนมัติ. หลัง template ถูก merge ให้เลือก **MC Controller** จาก Templates ใน Dokploy, ตั้ง domain และ (หากต้องใช้) `CURSEFORGE_API_KEY`; Dokploy จะสร้าง `JWT_SECRET` ให้เอง.

Minecraft server ที่ถูกสร้างจากหน้าเว็บยัง publish port ตรงบน Docker host ดังนั้นเปิด firewall/security group สำหรับช่วง `25565-25600` (หรือช่วงที่ตั้งไว้) ด้วย. Docker socket เป็นสิทธิ์ระดับสูง: จำกัดการเข้าถึง web panel และใช้ HTTPS/รหัสผ่านผู้ดูแลที่รัดกุม.

## รันปกติโดยไม่ใช้ Docker

```sh
npm install
npm run dev
```

จากนั้นเปิด `http://localhost:3000` ได้เลย. SQLite จะสร้างที่ `./data/mc-controller.db` และการเปิดเว็บ, สร้างผู้ใช้, ดู/แก้ไขรายการเซิร์ฟเวอร์ และจัดการไฟล์ ไม่ต้องมี Docker.

บน Windows ตอนกด **เริ่ม** ระบบจะตรวจ Java class version จากไฟล์ Minecraft ของเวอร์ชันที่เลือก แล้วดาวน์โหลด Temurin JRE major ที่ต้องใช้ (เช่น Java 21 หรือ 25) แบบ portable ไปที่ `data/bin/temurin-jre-<version>` โดยอัตโนมัติ — ไม่ติดตั้ง Java ลงเครื่องและไม่ต้องมี Docker. จากนั้น Minecraft จะทำงานเป็น Java process บนเครื่องโดยตรง. CurseForge จะดาวน์โหลด server pack ผ่าน `CURSEFORGE_API_KEY`; modpack ที่ไม่มี server pack จะไม่สามารถเปิดแบบ server ได้.

ใน Docker/Dokploy compose กำหนด `NUXT_MC_RUNTIME=docker` ไว้แล้ว. สำหรับ local `npm run dev` ใช้ native launcher โดยอัตโนมัติ. ตั้ง `MC_RUNTIME=native` ได้เมื่อต้องการบังคับ native runtime และ `NUXT_MC_RUNTIME` ใช้สำหรับ override runtime config ของ Nuxt ใน deployment.

## File manager

รองรับสร้างโฟลเดอร์, อัปโหลดหลายไฟล์รวม ZIP, เปิด/แก้ไข text file, ดาวน์โหลดไฟล์หรือหลายรายการเป็น ZIP, ลบ และแตก ZIP ภายหลังโดยกด `แตก ZIP` ที่แถวนั้น. ไฟล์จะอยู่ใน `${MC_DATA_PATH}/<server-id>`.
