# MC Controller

เว็บ Nuxt 4 สำหรับสร้างและดูแล Minecraft หลายเซิร์ฟเวอร์ผ่าน Docker: Vanilla, Fabric, Forge, NeoForge, Paper, Spigot, Bukkit และ CurseForge modpack พร้อมเลือกเวอร์ชันล่าสุดจาก upstream, พอร์ตไม่ซ้ำ, RCON console และ file manager

## เริ่มด้วย Docker Compose

1. คัดลอก `.env.example` เป็น `.env` แล้วกำหนด `JWT_SECRET` เป็นค่าสุ่มยาว ๆ
2. ตั้ง `MC_DATA_HOST_PATH` เป็น **absolute path บน Docker host** เช่น `/opt/mc-controller/data` และสร้างไดเรกทอรีนั้น
3. รัน `docker compose up -d --build`
4. เปิด `http://host:3000` แล้วระบบจะพาไปสร้างผู้ดูแลคนแรกอัตโนมัติ

พอร์ต Minecraft ถูก publish เป็น `25565-25600` และค่าเริ่มต้นจะเลือกพอร์ตแรกที่ยังไม่ใช้. เปลี่ยนช่วงได้ด้วย `PORT_RANGE_START` และ `PORT_RANGE_END` แต่ต้องแก้ port range ใน compose ให้ตรงกันด้วย.

## Dokploy และ Docker Hub

สร้าง image เดียวจาก `Dockerfile`:

```sh
docker build -t DOCKERHUB_USER/mc-controller:latest .
docker push DOCKERHUB_USER/mc-controller:latest
```

ใน Dokploy ใช้ `docker-compose.prod.yml`, กำหนด `DOCKER_HUB_USERNAME`, `JWT_SECRET`, `MC_DATA_HOST_PATH` และ (ถ้าต้องใช้ modpack) `CURSEFORGE_API_KEY`. เพิ่ม bind mount `${MC_DATA_HOST_PATH}:/data` และ mount `/var/run/docker.sock:/var/run/docker.sock` ตามไฟล์ compose แล้ว publish `3000` สำหรับเว็บและ `25565-25600` สำหรับ Minecraft.

> Docker socket ให้สิทธิ์สูงมากแก่แอปนี้: อย่าเปิดแผงควบคุมสู่สาธารณะโดยไม่มี HTTPS/การป้องกันเครือข่าย และใช้รหัสผ่านผู้ดูแลที่รัดกุม.

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
